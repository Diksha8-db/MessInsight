import { NextRequest } from 'next/server';
import { withApiHandler, NextRouteContext } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAdmin } from '@/server/middleware/guards';
import { AdminService } from '@/server/services/adminService';

type Params = { id: string };

export const GET = withApiHandler<Params>(async (req: NextRequest, { correlationId, params }) => {
  await requireAdmin(req);
  const { id } = await params!;
  const user = await AdminService.getUser(id);
  return createSuccessResponse(user, 'User retrieved successfully');
});

