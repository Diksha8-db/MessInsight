import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AuthService } from '@/server/services/authService';
import { verifySessionToken } from '@/server/lib/auth';
import { env } from '@/server/config/env';

export const POST = withApiHandler(async (req: NextRequest) => {
  const token = req.cookies.get(env.COOKIE_NAME)?.value;
  if (token) {
    try {
      const payload = verifySessionToken(token);
      await AuthService.logout(payload.sub);
    } catch {
      // Ignore token parse error during logout; session cookie will still be cleared
    }
  }

  const response = createSuccessResponse(null, 'Logged out successfully', 200, undefined, {
    'Cache-Control': 'no-store, max-age=0',
  });

  response.cookies.delete(env.COOKIE_NAME);
  return response;
});

