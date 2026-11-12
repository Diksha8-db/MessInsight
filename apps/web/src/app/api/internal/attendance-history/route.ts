import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AttendanceService } from '@/server/services/attendanceService';
import { AppError, ErrorCode } from '@/server/lib/errors';
import { env } from '@/server/config/env';

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const secretHeader = req.headers.get('x-ml-service-secret');
  if (!secretHeader) {
    throw AppError.unauthorized('Missing service secret', ErrorCode.UNAUTHORIZED);
  }

  const expected = Buffer.from(env.ML_SERVICE_SECRET);
  const provided = Buffer.from(secretHeader);

  if (
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(expected, provided)
  ) {
    throw AppError.forbidden('Invalid service secret', ErrorCode.FORBIDDEN);
  }

  const searchParams = req.nextUrl.searchParams;
  const messId = searchParams.get('messId');
  if (!messId) {
    throw AppError.badRequest('messId query param is required');
  }

  const from = searchParams.get('from') || '2000-01-01';
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0];

  const history = await AttendanceService.getAttendanceHistory(messId, from, to, correlationId);
  return createSuccessResponse(history, 'Attendance history retrieved');
});

