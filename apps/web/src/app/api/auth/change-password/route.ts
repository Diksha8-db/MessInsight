import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AuthService } from '@/server/services/authService';
import { changePasswordSchema } from '@/server/validators/authValidators';
import { verifySessionToken } from '@/server/lib/auth';
import { AppError } from '@/server/lib/errors';
import { env } from '@/server/config/env';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const token = req.cookies.get(env.COOKIE_NAME)?.value;
  if (!token) {
    throw AppError.unauthorized('Authentication required to change password');
  }

  const payload = verifySessionToken(token);
  const body = await req.json();
  const parsed = changePasswordSchema.parse(body);

  const result = await AuthService.changePassword(payload.sub, parsed, correlationId);
  return createSuccessResponse(null, result.message, 200);
});

