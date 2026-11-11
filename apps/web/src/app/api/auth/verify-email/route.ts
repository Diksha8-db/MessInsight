import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AuthService } from '@/server/services/authService';
import { verifyEmailSchema } from '@/server/validators/authValidators';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const body = await req.json();
  const parsed = verifyEmailSchema.parse(body);

  const result = await AuthService.verifyEmail(parsed, correlationId);
  return createSuccessResponse(result.user, result.message, 200);
});

