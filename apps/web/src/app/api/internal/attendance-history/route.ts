import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AttendanceService } from '@/server/services/attendanceService';
import { AppError } from '@/server/lib/errors';
import { requireInternalSecret } from '@/server/middleware/guards';

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  requireInternalSecret(req);

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
