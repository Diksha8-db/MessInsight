import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAdmin } from '@/server/middleware/guards';
import { AdminService } from '@/server/services/adminService';

type Params = { id: string };

export const PATCH = withApiHandler<Params>(async (req: NextRequest, { correlationId, params }) => {
  const session = await requireAdmin(req);
  const { id } = await params!;
  const result = await AdminService.blockUser(session.sub, id, correlationId);
  return createSuccessResponse(result, result.message);
});

