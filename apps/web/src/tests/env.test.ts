import { describe, it, expect } from 'vitest';
import { parseEnv } from '../server/config/env';

describe('Environment Configuration Validation (env.ts)', () => {
  const validEnv = {
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://localhost:27017/messinsight_test',
    JWT_SECRET: 'a_very_long_secure_secret_key_that_is_at_least_32_characters_long',
    INSTITUTE_EMAIL_DOMAIN: 'college.edu',
    ML_SERVICE_URL: 'http://localhost:8000',
    ML_SERVICE_SECRET: 'ml_secret_key_at_least_16_chars',
  };

  it('succeeds when all mandatory environment variables are present and valid', () => {
    const config = parseEnv(validEnv as unknown as NodeJS.ProcessEnv);
    expect(config.MONGODB_URI).toBe(validEnv.MONGODB_URI);
    expect(config.JWT_SECRET).toBe(validEnv.JWT_SECRET);
    expect(config.INSTITUTE_EMAIL_DOMAIN).toBe(validEnv.INSTITUTE_EMAIL_DOMAIN);
    expect(config.ML_SERVICE_URL).toBe(validEnv.ML_SERVICE_URL);
    expect(config.MESS_TIMEZONE).toBe('Asia/Kolkata'); // default value
    expect(config.PORT).toBe(3000); // default value
  });

  it('fails fast and throws when MONGODB_URI is missing', () => {
    const invalidEnv = { ...validEnv, MONGODB_URI: '' };
    expect(() => parseEnv(invalidEnv as unknown as NodeJS.ProcessEnv)).toThrow(
      /Environment variable validation failed.*MONGODB_URI/s
    );
  });

  it('fails fast when JWT_SECRET is shorter than 32 characters', () => {
    const invalidEnv = { ...validEnv, JWT_SECRET: 'short_secret' };
    expect(() => parseEnv(invalidEnv as unknown as NodeJS.ProcessEnv)).toThrow(
      /JWT_SECRET must be at least 32 characters long/
    );
  });

  it('fails fast when ML_SERVICE_URL is not a valid URL', () => {
    const invalidEnv = { ...validEnv, ML_SERVICE_URL: 'not-a-valid-url' };
    expect(() => parseEnv(invalidEnv as unknown as NodeJS.ProcessEnv)).toThrow(
      /ML_SERVICE_URL must be a valid URL/
    );
  });

  it('fails fast when ML_SERVICE_SECRET is less than 16 characters', () => {
    const invalidEnv = { ...validEnv, ML_SERVICE_SECRET: 'too_short' };
    expect(() => parseEnv(invalidEnv as unknown as NodeJS.ProcessEnv)).toThrow(
      /ML_SERVICE_SECRET must be at least 16 characters/
    );
  });
});

