const SENSITIVE_KEY_PATTERN =
  /password|(^|[_-])pass($|[_-])|token|otp|rekening|nrekening|secret|authorization|api[-_]?key|private[-_]?key/i;

export const MASKED_VALUE = '***MASKED***';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? MASKED_VALUE
        : sanitize(item);
    }
    return result;
  }

  return value;
}

export function sanitizeRecord(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return sanitize(value) as Record<string, unknown>;
}
