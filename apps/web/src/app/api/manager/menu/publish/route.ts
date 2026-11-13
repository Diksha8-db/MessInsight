import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { MenuService } from '@/server/services/menuService';
import { publishMenuSchema } from '@/server/validators/menuValidators';
import { AppError, ErrorCode } from '@/server/lib/errors';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  const body = await req.json();

  const messId = session.messId || body.messId;
  if (!messId) {
    throw AppError.badRequest('No mess assigned to this manager session.', ErrorCode.BAD_REQUEST);
  }
  requireMessScope(session, messId);

  delete body.messId;
  const input = publishMenuSchema.parse(body);
  const result = await MenuService.publishMenu(messId, input, correlationId);

  return createSuccessResponse(
    result.menu,
    result.alreadyPublished ? 'Menu was already published (idempotent).' : 'Menu published successfully.'
  );
});

