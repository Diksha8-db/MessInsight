import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ErrorCode } from './errors';
import { createErrorResponse } from './response';
import { logger } from './logger';

export interface ApiHandlerContext<TParams = Record<string, string>> {
  correlationId: string;
  params?: Promise<TParams>;
}

export type NextRouteContext<TParams = Record<string, string>> = {
  params: Promise<TParams>;
};

export function getCorrelationId(req: NextRequest): string {
  const headerId = req.headers.get('x-correlation-id') || req.headers.get('x-request-id');
  if (headerId && headerId.trim().length > 0) {
    return headerId.trim();
  }
  return crypto.randomUUID();
}

// Overload 1: Handler for routes without dynamic route parameters (e.g., /api/health)
export function withApiHandler(
  handler: (req: NextRequest, ctx: ApiHandlerContext) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse>;

// Overload 2: Handler for routes with dynamic route parameters (e.g., /api/manager/menu/[id])
export function withApiHandler<TParams = Record<string, string>>(
  handler: (req: NextRequest, ctx: ApiHandlerContext<TParams>) => Promise<NextResponse>
): (req: NextRequest, context: NextRouteContext<TParams>) => Promise<NextResponse>;

// Implementation
export function withApiHandler<TParams = Record<string, string>>(
  handler: (req: NextRequest, ctx: ApiHandlerContext<TParams>) => Promise<NextResponse>
) {
  return async (
    req: NextRequest,
    routeContext?: NextRouteContext<TParams>
  ): Promise<NextResponse> => {
    const correlationId = getCorrelationId(req);
    const method = req.method;
    const url = req.nextUrl.pathname;

    logger.info(`[API Request] ${method} ${url}`, correlationId);

    try {
      const response = await handler(req, {
        correlationId,
        params: routeContext?.params,
      });

      // Ensure correlation ID is attached to every response
      response.headers.set('x-correlation-id', correlationId);
      return response;
    } catch (err: unknown) {
      if (err instanceof AppError) {
        if (err.statusCode >= 500) {
          logger.error(`[AppError ${err.statusCode}] ${err.message}`, correlationId, undefined, err);
        } else {
          logger.warn(`[AppError ${err.statusCode}] ${err.message}`, correlationId, {
            code: err.code,
            details: err.details,
          });
        }

        return createErrorResponse(
          err.message,
          err.code,
          err.statusCode,
          correlationId,
          err.details,
          { 'x-correlation-id': correlationId }
        );
      }

      if (err instanceof ZodError) {
        logger.warn(`[ValidationError] Schema validation failed for ${method} ${url}`, correlationId, {
          issues: err.issues,
        });

        return createErrorResponse(
          'Request validation failed',
          ErrorCode.VALIDATION_ERROR,
          422,
          correlationId,
          err.flatten().fieldErrors,
          { 'x-correlation-id': correlationId }
        );
      }

      // Unhandled / system error: NEVER leak message or stack to client
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error(`[UnhandledError] Internal error on ${method} ${url}`, correlationId, undefined, errorObj);

      return createErrorResponse(
        'An unexpected internal error occurred. Please contact support.',
        ErrorCode.INTERNAL_SERVER_ERROR,
        500,
        correlationId,
        undefined,
        { 'x-correlation-id': correlationId }
      );
    }
  };
}

