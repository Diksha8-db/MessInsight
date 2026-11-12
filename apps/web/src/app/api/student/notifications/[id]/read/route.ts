import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAuth } from '@/server/middleware/guards';
import { NotificationService } from '@/server/services/notificationService';
import { AppError, ErrorCode } from '@/server/lib/errors';

export const PATCH = withApiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireAuth(req);
  const { id } = await (params ?? Promise.resolve({ id: '' }));
  const success = await NotificationService.markNotificationRead(id, session.sub);

  if (!success) {
    throw AppError.notFound('Notification not found or already read', ErrorCode.NOT_FOUND);
  }

  return createSuccessResponse({ success: true }, 'Notification marked as read');
});
