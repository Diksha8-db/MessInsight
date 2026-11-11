import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AuthService } from '@/server/services/authService';
import { changePasswordSchema } from '@/server/validators/authValidators';
import { requireAuth } from '@/server/middleware/guards';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireAuth(req);
  const body = await req.json();
  const parsed = changePasswordSchema.parse(body);

  const result = await AuthService.changePassword(session.sub, parsed, correlationId);
  return createSuccessResponse(null, result.message, 200);
});

