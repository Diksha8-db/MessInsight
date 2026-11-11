import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAdmin } from '@/server/middleware/guards';
import { AdminService } from '@/server/services/adminService';

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  await requireAdmin(req);
  const stats = await AdminService.getStats();
  return createSuccessResponse(stats, 'Stats retrieved successfully');
});

