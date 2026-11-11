import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAdmin } from '@/server/middleware/guards';
import { AdminService } from '@/server/services/adminService';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  await requireAdmin(req);
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { page, limit } = querySchema.parse(params);
  const result = await AdminService.listAuditLogs(page, limit);
  return createSuccessResponse(result, 'Audit logs retrieved', 200, {
    page,
    total: result.total,
  });
});

