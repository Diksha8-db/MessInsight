import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAdmin } from '@/server/middleware/guards';
import { AdminService } from '@/server/services/adminService';
import { UserRole } from '@/server/models/User';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.nativeEnum(UserRole).optional(),
  isBlocked: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  search: z.string().max(100).optional(),
});

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  await requireAdmin(req);

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const filter = listQuerySchema.parse(params);

  const result = await AdminService.listUsers(filter);
  return createSuccessResponse(result, 'Users retrieved successfully', 200, {
    page: result.page,
    totalPages: result.totalPages,
    total: result.total,
  });
});

