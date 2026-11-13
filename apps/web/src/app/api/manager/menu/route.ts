import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { MenuService } from '@/server/services/menuService';
import { createMenuSchema, menuListQuerySchema } from '@/server/validators/menuValidators';
import { AppError, ErrorCode } from '@/server/lib/errors';

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

  const messId = session.messId || body.messId;
  if (!messId) {
    throw AppError.badRequest('No mess assigned to this manager session.', ErrorCode.BAD_REQUEST);
  }
  requireMessScope(session, messId);

  delete body.messId;
  delete body.userId;
  delete body.role;

  const input = createMenuSchema.parse(body);
  const menu = await MenuService.createMenu(messId, input, correlationId);
  return createSuccessResponse(menu, 'Menu created successfully', 201);
});

