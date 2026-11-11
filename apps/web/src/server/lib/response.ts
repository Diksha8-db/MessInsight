import { NextResponse } from 'next/server';
import { ErrorCode } from './errors';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
    correlationId: string;
  };
}

export function createSuccessResponse<T>(
  data: T,
  message: string = 'Operation successful',
  statusCode: number = 200,
  meta?: Record<string, unknown>,
  headers?: Record<string, string>
): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = {
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  };

  return NextResponse.json(body, {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function createErrorResponse(
  message: string,
  code: ErrorCode | string = ErrorCode.INTERNAL_SERVER_ERROR,
  statusCode: number = 500,
  correlationId: string,
  details?: unknown,
  headers?: Record<string, string>
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    success: false,
    message,
    error: {
      code,
      correlationId,
      ...(details !== undefined ? { details } : {}),
    },
  };

  return NextResponse.json(body, {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

