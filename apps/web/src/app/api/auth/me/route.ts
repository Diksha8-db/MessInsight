import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AuthService } from '@/server/services/authService';
import { verifySessionToken } from '@/server/lib/auth';
import { UserRepository } from '@/server/repositories/UserRepository';
import { AppError } from '@/server/lib/errors';
import { env } from '@/server/config/env';

export const GET = withApiHandler(async (req: NextRequest) => {
  const token = req.cookies.get(env.COOKIE_NAME)?.value;
  if (!token) {
    throw AppError.unauthorized('Not authenticated');
  }

  const payload = verifySessionToken(token);
  const user = await UserRepository.findById(payload.sub);

  if (!user || user.isBlocked) {
    throw AppError.unauthorized('User session is no longer active');
  }

  // Enforce session invalidation if tokenVersion bumped
  if (user.tokenVersion !== payload.tokenVersion) {
    throw AppError.unauthorized('Session has been revoked. Please log in again.');
  }

  const sanitized = AuthService.sanitizeUser(user);
  return createSuccessResponse(sanitized, 'User profile fetched successfully');
});

