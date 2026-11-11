import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AuthService } from '@/server/services/authService';
import { forgotPasswordSchema } from '@/server/validators/authValidators';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const body = await req.json();
  const parsed = forgotPasswordSchema.parse(body);

  const result = await AuthService.forgotPassword(parsed, correlationId);
  return createSuccessResponse(null, result.message, 200);
});

