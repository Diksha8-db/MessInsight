export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    details?: unknown;
    correlationId: string;
  };
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly correlationId?: string;
  public readonly details?: unknown;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    statusCode: number,
    code: string = 'UNKNOWN_ERROR',
    correlationId?: string,
    details?: unknown,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.correlationId = correlationId;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'You are not logged in. Please sign in.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  ACCOUNT_BLOCKED: 'Your account has been deactivated. Please contact campus admin.',
  EMAIL_NOT_VERIFIED: 'Please verify your institute email before logging in.',
  INVALID_CREDENTIALS: 'Incorrect email or password.',
  OTP_EXPIRED: 'The verification code has expired. Please request a new one.',
  OTP_INVALID: 'Incorrect verification code. Please check and try again.',
  OTP_MAX_ATTEMPTS: 'Maximum attempts reached. Please request a fresh verification code.',
  OTP_COOLDOWN: 'Please wait before requesting another code.',
  RATE_LIMITED: 'Too many requests. Please wait before trying again.',
  VALIDATION_ERROR: 'Please review and correct the errors on the form.',
  CONFLICT: 'A record with this information already exists.',
  INTERNAL_SERVER_ERROR: 'Something went wrong on the server. Please try again.',
};

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
  retries = 1
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data: ApiResponse<T> = isJson ? await response.json() : ({} as ApiResponse<T>);

    if (!response.ok) {
      const code = data.error?.code || 'UNKNOWN_ERROR';
      const userMessage = data.message || ERROR_MESSAGES[code] || 'An unexpected error occurred.';
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

      // Handle 401 Session Expiry redirection in browser
      if (response.status === 401 && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
          const returnUrl = encodeURIComponent(currentPath);
          window.location.href = `/login?returnUrl=${returnUrl}`;
        }
      }

      throw new ApiClientError(
        userMessage,
        response.status,
        code,
        data.error?.correlationId,
        data.error?.details,
        retryAfter
      );
    }

    return data;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof ApiClientError) {
      throw err;
    }

    // Retry once for idempotent GET requests on network failures
    const isGet = (options.method || 'GET').toUpperCase() === 'GET';
    if (retries > 0 && isGet) {
      return apiClient<T>(endpoint, options, retries - 1);
    }

    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiClientError('Request timed out. Please check your network connection.', 408, 'TIMEOUT');
    }

    throw new ApiClientError(
      'Network error. Could not connect to the server.',
      0,
      'NETWORK_ERROR'
    );
  }
}

