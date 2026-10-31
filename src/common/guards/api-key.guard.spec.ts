import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard.js';
import {
  buildPayloadToSign,
  generateHmacSignature,
} from '../utils/signature.util.js';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    configService = { get: jest.fn() };
    guard = new ApiKeyGuard(
      reflector as unknown as Reflector,
      configService as unknown as ConfigService,
    );
  });

  const makeContext = (
    headers: Record<string, string | undefined>,
    method = 'GET',
    url = '/api/v1/notifications',
    body?: unknown,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          method,
          url,
          originalUrl: url,
          body,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  it('allows access if route is marked as public', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true);
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('allows access in non-production if API_KEY is not configured', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue(undefined);
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    expect(guard.canActivate(makeContext({}))).toBe(true);
    process.env.NODE_ENV = origEnv;
  });

  it('throws in production if API_KEY is not configured', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue(undefined);
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(() => guard.canActivate(makeContext({}))).toThrow(
      'API key is not configured',
    );
    process.env.NODE_ENV = origEnv;
  });

  it('throws if API key is missing or invalid', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('secret-123');
    expect(() => guard.canActivate(makeContext({}))).toThrow(
      'Invalid or missing API key',
    );
    expect(() =>
      guard.canActivate(makeContext({ 'x-api-key': 'wrong' })),
    ).toThrow('Invalid or missing API key');
  });

  it('accepts API key via Authorization Bearer header', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    configService.get.mockReturnValue('secret-123');
    expect(
      guard.canActivate(makeContext({ authorization: 'Bearer secret-123' })),
    ).toBe(true);
  });

  it('allows request with valid API key when SkipSignature is set', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    configService.get.mockReturnValue('secret-123');
    expect(guard.canActivate(makeContext({ 'x-api-key': 'secret-123' }))).toBe(
      true,
    );
  });

  it('throws if X-Signature header is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('secret-123');
    expect(() =>
      guard.canActivate(makeContext({ 'x-api-key': 'secret-123' })),
    ).toThrow('Missing X-Signature header');
  });

  it('throws if X-Timestamp header is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('secret-123');
    expect(() =>
      guard.canActivate(
        makeContext({
          'x-api-key': 'secret-123',
          'x-signature': 'sig',
        }),
      ),
    ).toThrow('Missing X-Timestamp header');
  });

  it('throws if X-Timestamp is invalid', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('secret-123');
    expect(() =>
      guard.canActivate(
        makeContext({
          'x-api-key': 'secret-123',
          'x-signature': 'sig',
          'x-timestamp': 'invalid-date',
        }),
      ),
    ).toThrow('Invalid X-Timestamp header format');
  });

  it('throws if request signature is expired (> 5 minutes)', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('secret-123');
    const expiredTs = (Date.now() - 6 * 60 * 1000).toString();
    expect(() =>
      guard.canActivate(
        makeContext({
          'x-api-key': 'secret-123',
          'x-signature': 'sig',
          'x-timestamp': expiredTs,
        }),
      ),
    ).toThrow('Request signature expired');
  });

  it('throws if signature is invalid', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('secret-123');
    const nowTs = Date.now().toString();
    expect(() =>
      guard.canActivate(
        makeContext({
          'x-api-key': 'secret-123',
          'x-signature': 'deadbeef001122',
          'x-timestamp': nowTs,
        }),
      ),
    ).toThrow('Invalid request signature');
  });

  it('allows request with valid API key and signature', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('secret-123');
    const nowTs = Date.now().toString();
    const payload = buildPayloadToSign({
      method: 'GET',
      path: '/api/v1/notifications',
      timestamp: nowTs,
    });
    const validSig = generateHmacSignature(payload, 'secret-123');

    expect(
      guard.canActivate(
        makeContext({
          'x-api-key': 'secret-123',
          'x-signature': validSig,
          'x-timestamp': nowTs,
        }),
      ),
    ).toBe(true);
  });
});
