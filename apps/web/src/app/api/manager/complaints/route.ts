import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { ComplaintService } from '@/server/services/complaintService';
import { ComplaintPriority, ComplaintStatus } from '@/server/models/Complaint';
import { AppError, ErrorCode } from '@/server/lib/errors';

export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireManager(req);
  const searchParams = req.nextUrl.searchParams;

  const messId = searchParams.get('messId') || session.messId;
  if (!messId) {
    throw AppError.badRequest('messId query parameter or manager assignment required', ErrorCode.BAD_REQUEST);
  }
  requireMessScope(session, messId);

  const status = searchParams.get('status') as ComplaintStatus | undefined;
  const priority = searchParams.get('priority') as ComplaintPriority | undefined;
  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '20');

  const result = await ComplaintService.listMessComplaints(messId, {
    status,
    priority,
    page,
    limit,
  });

  return createSuccessResponse(result, 'Mess complaints retrieved');
});

