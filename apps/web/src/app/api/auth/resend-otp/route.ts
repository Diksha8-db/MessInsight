import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AuthService } from '@/server/services/authService';
import { resendOtpSchema } from '@/server/validators/authValidators';

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = resendOtpSchema.parse(body);

  const result = await AuthService.resendOtp(parsed);
  return createSuccessResponse(null, result.message, 200);
});

