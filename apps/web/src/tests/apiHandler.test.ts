import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '../server/lib/apiHandler';
import { createSuccessResponse } from '../server/lib/response';
import { AppError, ErrorCode } from '../server/lib/errors';

describe('API Route Handler Wrapper (withApiHandler)', () => {
  it('returns success response with preserved or generated correlationId', async () => {
    const handler = withApiHandler(async () => {
      return createSuccessResponse({ test: true }, 'Success');
    });

    const req = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-correlation-id': 'custom-corr-id-999' },
    });

    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('x-correlation-id')).toBe('custom-corr-id-999');
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ test: true });
  });

  it('converts a thrown AppError into the standard error response', async () => {
    const handler = withApiHandler(async () => {
      throw AppError.forbidden('Only mess managers can publish menus', ErrorCode.FORBIDDEN);
    });

    const req = new NextRequest('http://localhost:3000/api/test');
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.message).toBe('Only mess managers can publish menus');
    expect(json.error.code).toBe(ErrorCode.FORBIDDEN);
    expect(json.error.correlationId).toBeDefined();
    expect(res.headers.get('x-correlation-id')).toBe(json.error.correlationId);
  });

  it('converts a ZodError into 422 VALIDATION_ERROR with field issues', async () => {
    const testSchema = z.object({
      email: z.string().email(),
      rating: z.number().int().min(1).max(5),
    });

    const handler = withApiHandler(async () => {
      testSchema.parse({ email: 'not-an-email', rating: 10 });
      return createSuccessResponse({});
    });

    const req = new NextRequest('http://localhost:3000/api/test');
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(json.error.details.email).toBeDefined();
    expect(json.error.details.rating).toBeDefined();
  });

  it('converts an unknown Error into 500 without leaking stack traces or internal details', async () => {
    const handler = withApiHandler(async () => {
      throw new Error('Database password failed at mongodb://admin:secret123@cluster.mongodb.net');
    });

    const req = new NextRequest('http://localhost:3000/api/test');
    const res = await handler(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(json.message).toBe('An unexpected internal error occurred. Please contact support.');
    expect(json.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    // Ensure raw error message and stack trace are NEVER returned to client
    expect(JSON.stringify(json)).not.toContain('secret123');
    expect(JSON.stringify(json)).not.toContain('Database password failed');
    expect(json.stack).toBeUndefined();
  });
});

