import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireStudent } from '@/server/middleware/guards';
import { FeedbackService } from '@/server/services/feedbackService';
import { createFeedbackSchema } from '@/server/validators/feedbackValidators';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireStudent(req);
  const body = await req.json();
  const input = createFeedbackSchema.parse(body);

  const feedback = await FeedbackService.submitFeedback(session.sub, input, correlationId);
  return createSuccessResponse(feedback, 'Feedback submitted successfully', 201);
});

export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireStudent(req);
  const searchParams = req.nextUrl.searchParams;
  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '20');

  const result = await FeedbackService.getStudentHistory(session.sub, page, limit);
  return createSuccessResponse(result, 'Feedback history retrieved');
});

