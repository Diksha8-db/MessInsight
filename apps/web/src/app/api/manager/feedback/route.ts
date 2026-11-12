import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { FeedbackService } from '@/server/services/feedbackService';
import { AppError, ErrorCode } from '@/server/lib/errors';

export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireManager(req);
  const searchParams = req.nextUrl.searchParams;

  const messId = searchParams.get('messId') || session.messId;
  if (!messId) {
    throw AppError.badRequest('messId query parameter or manager assignment required', ErrorCode.BAD_REQUEST);
  }
  requireMessScope(session, messId);

  const serviceDate = searchParams.get('serviceDate') || undefined;
  const mealType = searchParams.get('mealType') || undefined;
  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '20');

  const result = await FeedbackService.getMessFeedback(messId, {
    serviceDate,
    mealType,
    page,
    limit,
  });

  return createSuccessResponse(result, 'Mess feedback retrieved');
});

