import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAuth } from '@/server/middleware/guards';
import { NotificationService } from '@/server/services/notificationService';

export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireAuth(req);
  const searchParams = req.nextUrl.searchParams;
  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '20');

  const result = await NotificationService.getUserNotifications(session.sub, page, limit);
  return createSuccessResponse(result, 'Notifications retrieved');
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requireAuth(req);
  const count = await NotificationService.markAllNotificationsRead(session.sub);
  return createSuccessResponse({ markedCount: count }, 'All notifications marked as read');
});

