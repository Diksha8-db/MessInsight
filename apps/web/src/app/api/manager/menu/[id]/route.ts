import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope, rejectClientIdentity } from '@/server/middleware/guards';
import { MenuService } from '@/server/services/menuService';
import { updateMenuSchema } from '@/server/validators/menuValidators';

type Params = { id: string };

export const GET = withApiHandler<Params>(async (req: NextRequest, { correlationId, params }) => {
  const session = await requireManager(req);
  const { id } = await params!;
  const messId = req.nextUrl.searchParams.get('messId') || '';
  requireMessScope(session, messId);

  const menu = await MenuService.getMenu(id, messId);
  return createSuccessResponse(menu, 'Menu retrieved');
});

export const PUT = withApiHandler<Params>(async (req: NextRequest, { correlationId, params }) => {
  const session = await requireManager(req);
  const { id } = await params!;
  const body = await req.json();
  rejectClientIdentity(body);

  const { messId, ...rest } = z.object({ messId: z.string().min(1) }).passthrough().parse(body);
  requireMessScope(session, messId);

  const input = updateMenuSchema.parse(rest);
  const menu = await MenuService.updateMenu(id, messId, input, correlationId);
  return createSuccessResponse(menu, 'Menu updated');
});

export const DELETE = withApiHandler<Params>(async (req: NextRequest, { correlationId, params }) => {
  const session = await requireManager(req);
  const { id } = await params!;
  const messId = req.nextUrl.searchParams.get('messId') || '';
  requireMessScope(session, messId);

  const result = await MenuService.deleteMenu(id, messId, correlationId);
  return createSuccessResponse(result, result.message);
});

