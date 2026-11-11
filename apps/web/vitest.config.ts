import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://localhost:27017/messinsight_test',
      JWT_SECRET: 'a_very_long_secure_secret_key_that_is_at_least_32_characters_long',
      INSTITUTE_EMAIL_DOMAIN: 'college.edu',
      ML_SERVICE_URL: 'http://localhost:8000',
      ML_SERVICE_SECRET: 'ml_secret_key_at_least_16_chars',
      EMAIL_PROVIDER: 'console',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/tests/', '**/*.d.ts'],
    },
  },
});

