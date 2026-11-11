import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { AuthService } from '@/server/services/authService';
import { requireAuth } from '@/server/middleware/guards';

export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireAuth(req);
  const user = await AuthService.getMe(session.sub);
  return createSuccessResponse(user, 'User profile fetched successfully');
});

