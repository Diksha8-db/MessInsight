import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { AnalyticsService } from '@/server/services/analyticsService';
import { dateRangeSchema } from '@/server/validators/analyticsValidators';
import { AppError } from '@/server/lib/errors';

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  const searchParams = req.nextUrl.searchParams;
  const messId = searchParams.get('messId') || session.messId;

  if (!messId) {
    throw AppError.badRequest('messId is required');
  }
  requireMessScope(session, messId);

  const query = {
    from: searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    to: searchParams.get('to') || new Date().toISOString().split('T')[0],
    mealType: searchParams.get('mealType') || undefined,
  };

  const parsed = dateRangeSchema.parse(query);

  const [ratings, dishRatings] = await Promise.all([
    AnalyticsService.getAverageRatings(messId, parsed.from, parsed.to, parsed.mealType, correlationId),
    AnalyticsService.getDishRatings(messId, parsed.from, parsed.to, correlationId),
  ]);

  return createSuccessResponse({ ratings, dishRatings }, 'Ratings analytics retrieved');
});

