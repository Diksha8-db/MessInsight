import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { AttendanceService } from '@/server/services/attendanceService';
import { recordAttendanceSchema } from '@/server/validators/attendanceValidators';
import { AppError, ErrorCode } from '@/server/lib/errors';

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  const searchParams = req.nextUrl.searchParams;
  const messId = searchParams.get('messId') || session.messId;

  if (!messId) {
    throw AppError.badRequest('messId is required');
  }
  requireMessScope(session, messId);

  const from = searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const to = searchParams.get('to') || new Date().toISOString().split('T')[0];

  const records = await AttendanceService.listAttendance(messId, from, to, correlationId);
  return createSuccessResponse(records, 'Attendance records retrieved');
});

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  const body = await req.json();

  const messId = body.messId || session.messId;
  if (!messId) {
    throw AppError.badRequest('messId is required');
  }
  requireMessScope(session, messId);

  const parsed = recordAttendanceSchema.parse(body);
  const record = await AttendanceService.recordAttendance(
    messId,
    session.sub,
    parsed,
    correlationId
  );

  return createSuccessResponse(record, 'Attendance recorded successfully', 201);
});

