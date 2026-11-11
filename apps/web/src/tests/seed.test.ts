import { describe, it, expect } from 'vitest';
import { runSeed } from '../../../../scripts/seed';

describe('Seed Script Safety (seed.ts)', () => {
  it('strictly refuses to run when NODE_ENV is set to production', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';

    await expect(runSeed('mongodb://localhost:27017/fake')).rejects.toThrow(
      /Seeding is strictly forbidden in production environments/
    );

    (process.env as Record<string, string>).NODE_ENV = originalEnv!;
  });
});

