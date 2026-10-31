import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard.js';

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
    const origApiKey = process.env.API_KEY;
    delete process.env.API_KEY;
    process.env.NODE_ENV = 'development';
    expect(guard.canActivate(makeContext({}))).toBe(true);
    process.env.NODE_ENV = origEnv;
    if (origApiKey !== undefined) {
      process.env.API_KEY = origApiKey;
    }
  });

  it('throws in production if API_KEY is not configured', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue(undefined);
    const origEnv = process.env.NODE_ENV;
    const origApiKey = process.env.API_KEY;
    delete process.env.API_KEY;
    process.env.NODE_ENV = 'production';
    expect(() => guard.canActivate(makeContext({}))).toThrow(
      'API key is not configured',
    );
    process.env.NODE_ENV = origEnv;
    if (origApiKey !== undefined) {
      process.env.API_KEY = origApiKey;
    }
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
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('secret-123');
    expect(
      guard.canActivate(makeContext({ authorization: 'Bearer secret-123' })),
    ).toBe(true);
  });

  it('accepts valid API key directly via x-api-key header', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('secret-123');
    expect(guard.canActivate(makeContext({ 'x-api-key': 'secret-123' }))).toBe(
      true,
    );
  });
});
