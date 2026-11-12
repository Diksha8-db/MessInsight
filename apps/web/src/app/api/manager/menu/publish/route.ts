import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { MenuService } from '@/server/services/menuService';
import { publishMenuSchema } from '@/server/validators/menuValidators';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  const body = await req.json();

  const { messId, ...rest } = z.object({ messId: z.string().min(1) }).passthrough().parse(body);
  requireMessScope(session, messId);

  const input = publishMenuSchema.parse(rest);
  const result = await MenuService.publishMenu(messId, input, correlationId);

  return createSuccessResponse(
    result.menu,
    result.alreadyPublished ? 'Menu was already published (idempotent).' : 'Menu published successfully.'
  );
});

