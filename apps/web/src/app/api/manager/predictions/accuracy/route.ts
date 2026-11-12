import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { PredictionService } from '@/server/services/predictionService';
import { AppError } from '@/server/lib/errors';

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

  const accuracy = await PredictionService.getAccuracyMetrics(messId, from, to, correlationId);
  return createSuccessResponse(accuracy, 'Prediction accuracy metrics retrieved');
});

