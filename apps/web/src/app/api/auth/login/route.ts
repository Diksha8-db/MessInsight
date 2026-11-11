import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AuthService } from '@/server/services/authService';
import { loginSchema } from '@/server/validators/authValidators';
import { getSessionCookieOptions } from '@/server/lib/auth';
import { env } from '@/server/config/env';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const body = await req.json();
  const parsed = loginSchema.parse(body);

  const result = await AuthService.login(parsed, correlationId);

  const response = createSuccessResponse(result.user, 'Logged in successfully', 200, undefined, {
    'Cache-Control': 'no-store, max-age=0',
  });

  response.cookies.set(env.COOKIE_NAME, result.token, getSessionCookieOptions());
  return response;
});

