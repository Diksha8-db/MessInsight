type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const SENSITIVE_KEYS = new Set([
  'password',
  'confirmpassword',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'resettoken',
  'otp',
  'secret',
  'authorization',
  'cookie',
  'jwt',
  'apikey',
  'privatekey',
]);

export function scrubData(data: unknown, depth = 0): unknown {
  if (depth > 10) return '[MAX_DEPTH]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    let sanitized = data;
    // Scrub Bearer tokens
    if (/bearer\s+[a-zA-Z0-9._-]+/i.test(sanitized)) {
      sanitized = sanitized.replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]');
    }
    // Scrub URI credentials (e.g. mongodb://user:pass@host)
    if (/[a-zA-Z0-9+.-]+:\/\/[^:]+:[^@]+@/i.test(sanitized)) {
      sanitized = sanitized.replace(/([a-zA-Z0-9+.-]+:\/\/[^:]+:)[^@]+(@)/gi, '$1[REDACTED]$2');
    }
    // Scrub query or key-value passwords (password=xyz, otp=123456)
    if (/(password|secret|token|otp)=[^&\s]+/i.test(sanitized)) {
      sanitized = sanitized.replace(/(password|secret|token|otp)=[^&\s]+/gi, '$1=[REDACTED]');
    }
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map((item) => scrubData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEYS.has(normalizedKey)) {
        scrubbed[key] = '[REDACTED]';
      } else {
        scrubbed[key] = scrubData(value, depth + 1);
      }
    }
    return scrubbed;
  }

  return data;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

class StructuredLogger {
  private formatLog(
    level: LogLevel,
    message: string,
    correlationId?: string,
    context?: Record<string, unknown>,
    error?: Error & { code?: string }
  ): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(correlationId ? { correlationId } : {}),
      ...(context ? { context: scrubData(context) as Record<string, unknown> } : {}),
      ...(error
        ? {
            error: {
              name: error.name,
              message: scrubData(error.message) as string,
              ...(error.code ? { code: error.code } : {}),
              // Stack trace included in server logs only for 5xx/internal errors, never in client responses
              ...(process.env.NODE_ENV !== 'production' && error.stack
                ? { stack: scrubData(error.stack) as string }
                : {}),
            },
          }
        : {}),
    };

    return JSON.stringify(entry);
  }

  debug(message: string, correlationId?: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'test') return;
    console.debug(this.formatLog('DEBUG', message, correlationId, context));
  }

  info(message: string, correlationId?: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'test') return;
    console.info(this.formatLog('INFO', message, correlationId, context));
  }

  warn(message: string, correlationId?: string, context?: Record<string, unknown>) {
    console.warn(this.formatLog('WARN', message, correlationId, context));
  }

  error(
    message: string,
    correlationId?: string,
    context?: Record<string, unknown>,
    error?: Error & { code?: string }
  ) {
    console.error(this.formatLog('ERROR', message, correlationId, context, error));
  }
}

export const logger = new StructuredLogger();

