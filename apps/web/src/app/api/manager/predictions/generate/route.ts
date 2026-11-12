import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { PredictionService } from '@/server/services/predictionService';
import { generatePredictionSchema } from '@/server/validators/predictionValidators';
import { AppError } from '@/server/lib/errors';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  const body = await req.json();

  const messId = body.messId || session.messId;
  if (!messId) {
    throw AppError.badRequest('messId is required');
  }
  requireMessScope(session, messId);

  const parsed = generatePredictionSchema.parse(body);
  const prediction = await PredictionService.generatePrediction(
    messId,
    parsed.mealType,
    parsed.serviceDate,
    session.sub,
    correlationId,
    parsed.capacity
  );

  return createSuccessResponse(prediction, 'Prediction generated successfully', 201);
});

