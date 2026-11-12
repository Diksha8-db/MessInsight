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
  };

  const parsed = dateRangeSchema.parse(query);

  const [distribution, trend, topIssues] = await Promise.all([
    AnalyticsService.getSentimentDistribution(messId, parsed.from, parsed.to, correlationId),
    AnalyticsService.getSentimentTrend(messId, parsed.from, parsed.to, correlationId),
    AnalyticsService.getTopIssues(messId, parsed.from, parsed.to, correlationId),
  ]);

  return createSuccessResponse(
    { distribution, trend, topIssues },
    'Sentiment analytics retrieved'
  );
});

