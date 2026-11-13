import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAuth } from '@/server/middleware/guards';
import { MenuService } from '@/server/services/menuService';

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireAuth(req);
  const messId = req.nextUrl.searchParams.get('messId') || session.messId || undefined;

  const menus = await MenuService.getTodayMenu(messId);
  return createSuccessResponse(menus, "Today's menu retrieved");
});

