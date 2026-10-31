import { MASKED_VALUE, sanitize, sanitizeRecord } from './sanitizer.util.js';

describe('sanitize', () => {
  it('masks values of keys matching the sensitive pattern', () => {
    const result = sanitize({
      password: 'secret',
      pass: 'secret-pass',
      smtp_pass: 'smtp-secret',
      refreshToken: 'abc',
      otp: '123456',
      no_rekening: '1234567890',
      nrekening: '987',
      client_secret: 'sec123',
      authorization: 'Bearer xyz',
      username: 'john',
      passenger: 'ok',
    }) as Record<string, unknown>;

    expect(result.password).toBe(MASKED_VALUE);
    expect(result.pass).toBe(MASKED_VALUE);
    expect(result.smtp_pass).toBe(MASKED_VALUE);
    expect(result.refreshToken).toBe(MASKED_VALUE);
    expect(result.otp).toBe(MASKED_VALUE);
    expect(result.no_rekening).toBe(MASKED_VALUE);
    expect(result.nrekening).toBe(MASKED_VALUE);
    expect(result.client_secret).toBe(MASKED_VALUE);
    expect(result.authorization).toBe(MASKED_VALUE);
    expect(result.username).toBe('john');
    expect(result.passenger).toBe('ok');
  });
  it('matches sensitive keys case-insensitively', () => {
    const result = sanitize({ PASSWORD: 'x', Token: 'y' }) as Record<
      string,
      unknown
    >;
    expect(result.PASSWORD).toBe(MASKED_VALUE);
    expect(result.Token).toBe(MASKED_VALUE);
  });

  it('recursively sanitizes nested objects and arrays', () => {
    const result = sanitize({
      data: {
        items: [{ password: 'p' }, { value: 1 }],
        token: 't',
      },
    }) as { data: { items: Array<Record<string, unknown>>; token: string } };

    expect(result.data.token).toBe(MASKED_VALUE);
    expect(result.data.items[0].password).toBe(MASKED_VALUE);
    expect(result.data.items[1].value).toBe(1);
  });

  it('does not mutate the original object', () => {
    const original = { password: 'secret', keep: 'me' };
    sanitize(original);
    expect(original.password).toBe('secret');
  });

  it('leaves primitives untouched', () => {
    expect(sanitize('plain')).toBe('plain');
    expect(sanitize(42)).toBe(42);
    expect(sanitize(null)).toBeNull();
  });

  it('sanitizeRecord returns a masked record', () => {
    const result = sanitizeRecord({ api_token: 'abc', name: 'ok' });
    expect(result.api_token).toBe(MASKED_VALUE);
    expect(result.name).toBe('ok');
  });
});
