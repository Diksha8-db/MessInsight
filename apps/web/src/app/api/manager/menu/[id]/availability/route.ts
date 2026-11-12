import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { MenuService } from '@/server/services/menuService';
import { dishAvailabilitySchema } from '@/server/validators/menuValidators';

type Params = { id: string };

export const PATCH = withApiHandler<Params>(async (req: NextRequest, { correlationId, params }) => {
  const session = await requireManager(req);
  const { id } = await params!;
  const body = await req.json();

  const { messId, ...rest } = z.object({ messId: z.string().min(1) }).passthrough().parse(body);
  requireMessScope(session, messId);

  const input = dishAvailabilitySchema.parse(rest);
  const menu = await MenuService.setDishAvailability(id, messId, input, correlationId);
  return createSuccessResponse(menu, 'Dish availability updated');
});

