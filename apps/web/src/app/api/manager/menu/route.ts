import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager } from '@/server/middleware/guards';
import { requireMessScope, rejectClientIdentity } from '@/server/middleware/guards';
import { MenuService } from '@/server/services/menuService';
import { createMenuSchema, menuListQuerySchema } from '@/server/validators/menuValidators';

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { messId } = z.object({ messId: z.string().min(1) }).parse(params);
  requireMessScope(session, messId);

  const filter = menuListQuerySchema.parse(params);
  const result = await MenuService.listMenus(messId, filter);
  return createSuccessResponse(result, 'Menus retrieved', 200, {
    page: result.page,
    totalPages: result.totalPages,
    total: result.total,
  });
});

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  const body = await req.json();
  rejectClientIdentity(body);

  const { messId, ...rest } = z
    .object({ messId: z.string().min(1) })
    .passthrough()
    .parse(body);
  requireMessScope(session, messId);

  const input = createMenuSchema.parse(rest);
  const menu = await MenuService.createMenu(messId, input, correlationId);
  return createSuccessResponse(menu, 'Menu created successfully', 201);
});

