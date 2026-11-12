import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireStudent } from '@/server/middleware/guards';
import { FeedbackService } from '@/server/services/feedbackService';
import { updateFeedbackSchema } from '@/server/validators/feedbackValidators';

export const GET = withApiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireStudent(req);
  const { id } = await (params ?? Promise.resolve({ id: '' }));
  const feedback = await FeedbackService.getFeedbackById(id, session.sub);
  return createSuccessResponse(feedback, 'Feedback retrieved');
});

export const PUT = withApiHandler<{ id: string }>(async (req: NextRequest, { params, correlationId }) => {
  const session = await requireStudent(req);
  const { id } = await (params ?? Promise.resolve({ id: '' }));
  const body = await req.json();
  const input = updateFeedbackSchema.parse(body);

  const updated = await FeedbackService.updateFeedback(id, session.sub, input, correlationId);
  return createSuccessResponse(updated, 'Feedback updated successfully');
});

export const DELETE = withApiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireStudent(req);
  const { id } = await (params ?? Promise.resolve({ id: '' }));
  await FeedbackService.deleteFeedback(id, session.sub);
  return createSuccessResponse({ deleted: true }, 'Feedback deleted successfully');
});
