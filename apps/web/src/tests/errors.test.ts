import { describe, it, expect } from 'vitest';
import { AppError, ErrorCode } from '../server/lib/errors';
import { createErrorResponse, createSuccessResponse } from '../server/lib/response';

describe('Error & Response Infrastructure (errors.ts & response.ts)', () => {
  it('AppError creates operational error with correct status code and error code', () => {
    const err = AppError.badRequest('Invalid meal type', ErrorCode.BAD_REQUEST, { field: 'mealType' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorCode.BAD_REQUEST);
    expect(err.isOperational).toBe(true);
    expect(err.details).toEqual({ field: 'mealType' });
  });

  it('createSuccessResponse builds standard success envelope', async () => {
    const res = createSuccessResponse({ user: 'test' }, 'User fetched', 200, { page: 1 });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      success: true,
      message: 'User fetched',
      data: { user: 'test' },
      meta: { page: 1 },
    });
  });

  it('createErrorResponse builds standard error envelope without stack trace', async () => {
    const correlationId = 'test-corr-1234';
    const res = createErrorResponse(
      'Validation failed',
      ErrorCode.VALIDATION_ERROR,
      422,
      correlationId,
      { email: 'Invalid format' }
    );
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json).toEqual({
      success: false,
      message: 'Validation failed',
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        correlationId,
        details: { email: 'Invalid format' },
      },
    });

    // Verify stack traces or internals are strictly absent
    expect(json.stack).toBeUndefined();
    expect(json.error.stack).toBeUndefined();
  });
});

