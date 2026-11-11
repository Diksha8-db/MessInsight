export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_INVALID = 'OTP_INVALID',
  OTP_MAX_ATTEMPTS = 'OTP_MAX_ATTEMPTS',
  OTP_COOLDOWN = 'OTP_COOLDOWN',
  PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',
  INVALID_DOMAIN = 'INVALID_DOMAIN',

  // Request & Validation
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  EMPTY_MENU = 'EMPTY_MENU',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  STALE_VERSION = 'STALE_VERSION',
  EDIT_WINDOW_CLOSED = 'EDIT_WINDOW_CLOSED',

  // Resource & State
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  RATE_LIMITED = 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',

  // ML & External Integrations
  ML_SERVICE_UNAVAILABLE = 'ML_SERVICE_UNAVAILABLE',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',

  // System & Database
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code: ErrorCode = ErrorCode.BAD_REQUEST, details?: unknown) {
    return new AppError(message, 400, code, details);
  }

  static unauthorized(message: string = 'Authentication required', code: ErrorCode = ErrorCode.UNAUTHORIZED) {
    return new AppError(message, 401, code);
  }

  static forbidden(message: string = 'Access denied', code: ErrorCode = ErrorCode.FORBIDDEN) {
    return new AppError(message, 403, code);
  }

  static notFound(message: string = 'Resource not found', code: ErrorCode = ErrorCode.NOT_FOUND) {
    return new AppError(message, 404, code);
  }

  static conflict(message: string, code: ErrorCode = ErrorCode.CONFLICT, details?: unknown) {
    return new AppError(message, 409, code, details);
  }

  static unprocessable(message: string, code: ErrorCode = ErrorCode.VALIDATION_ERROR, details?: unknown) {
    return new AppError(message, 422, code, details);
  }

  static rateLimited(message: string = 'Too many requests, please try again later', retryAfterSeconds?: number) {
    return new AppError(
      message,
      429,
      ErrorCode.RATE_LIMITED,
      retryAfterSeconds ? { retryAfter: retryAfterSeconds } : undefined
    );
  }

  static internal(message: string = 'An unexpected internal error occurred') {
    return new AppError(message, 500, ErrorCode.INTERNAL_SERVER_ERROR);
  }
}

