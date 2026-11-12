import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { PredictionRepository } from '@/server/repositories/PredictionRepository';
import { AppError } from '@/server/lib/errors';
import { connectDb } from '@/server/lib/db';

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  const searchParams = req.nextUrl.searchParams;
  const messId = searchParams.get('messId') || session.messId;

  if (!messId) {
    throw AppError.badRequest('messId is required');
  }
  requireMessScope(session, messId);

  await connectDb();

  const from = searchParams.get('from') || new Date().toISOString().split('T')[0];
  const to = searchParams.get('to') || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const predictions = await PredictionRepository.listRange(messId, from, to);
  return createSuccessResponse(predictions, 'Predictions retrieved');
});

