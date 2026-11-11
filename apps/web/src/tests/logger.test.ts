import { describe, it, expect } from 'vitest';
import { scrubData } from '../server/lib/logger';

describe('Structured Logger Redaction (logger.ts)', () => {
  it('redacts sensitive fields: password, otp, token, secret, jwt', () => {
    const rawData = {
      email: 'student@college.edu',
      password: 'MySecretPassword123!',
      otp: '123456',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      secret: 'super-sensitive-secret',
      nested: {
        currentPassword: 'oldPassword!',
        newPassword: 'newPassword!',
        refreshToken: 'refresh-xyz',
      },
    };

    const sanitized = scrubData(rawData) as Record<string, unknown>;

    expect(sanitized.email).toBe('student@college.edu');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.otp).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.secret).toBe('[REDACTED]');

    const nested = sanitized.nested as Record<string, unknown>;
    expect(nested.currentPassword).toBe('[REDACTED]');
    expect(nested.newPassword).toBe('[REDACTED]');
    expect(nested.refreshToken).toBe('[REDACTED]');
  });

  it('redacts Authorization bearer header strings', () => {
    const headerString = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature';
    const sanitized = scrubData(headerString);
    expect(sanitized).toBe('Bearer [REDACTED]');
  });

  it('redacts URI database credentials and key-value secret pairs in strings', () => {
    const uriString = 'Failed to connect to mongodb://admin:secretPass123@cluster0.mongodb.net/messinsight';
    const sanitizedUri = scrubData(uriString);
    expect(sanitizedUri).toBe('Failed to connect to mongodb://admin:[REDACTED]@cluster0.mongodb.net/messinsight');

    const kvString = 'error with param password=superSecretPassword&token=12345';
    const sanitizedKv = scrubData(kvString);
    expect(sanitizedKv).toBe('error with param password=[REDACTED]&token=[REDACTED]');
  });

  it('handles array and primitive values safely without mutation', () => {
    const arr = [{ password: 'abc' }, 'normal string', 123, null];
    const sanitized = scrubData(arr) as unknown[];

    expect(sanitized[0]).toEqual({ password: '[REDACTED]' });
    expect(sanitized[1]).toBe('normal string');
    expect(sanitized[2]).toBe(123);
    expect(sanitized[3]).toBeNull();
  });
});

