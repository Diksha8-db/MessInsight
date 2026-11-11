import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Auth & Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('messinsight_session'),

  // Institute Configuration
  INSTITUTE_EMAIL_DOMAIN: z.string().min(1, 'INSTITUTE_EMAIL_DOMAIN is required (e.g., college.edu)'),
  MESS_TIMEZONE: z.string().default('Asia/Kolkata'),

  // ML Service Integration
  ML_SERVICE_URL: z.string().url('ML_SERVICE_URL must be a valid URL'),
  ML_SERVICE_SECRET: z.string().min(16, 'ML_SERVICE_SECRET must be at least 16 characters'),

  // Email Configuration
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'resend']).default('console'),
  EMAIL_FROM: z.string().email().default('no-reply@messinsight.local'),
  EMAIL_SMTP_HOST: z.string().optional(),
  EMAIL_SMTP_PORT: z.coerce.number().optional(),
  EMAIL_SMTP_USER: z.string().optional(),
  EMAIL_SMTP_PASS: z.string().optional(),

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().default(5 * 1024 * 1024), // 5MB
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    const message = `[FATAL] Environment variable validation failed:\n${errorDetails}\nPlease check your .env file or reference .env.example.`;
    
    // In test environment when explicitly testing fail-fast, throw error instead of calling process.exit
    if (rawEnv.NODE_ENV === 'test' || process.env.NODE_ENV === 'test') {
      throw new Error(message);
    }
    
    console.error(message);
    process.exit(1);
  }

  return result.data;
}

let cachedEnv: Env | null = null;

export const getEnv = (): Env => {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
};

// Export lazily evaluated env proxy so imports don't crash if imported dynamically in test runners
export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});

