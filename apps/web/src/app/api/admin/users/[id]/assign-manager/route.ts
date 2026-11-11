import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAdmin } from '@/server/middleware/guards';
import { AdminService } from '@/server/services/adminService';

type Params = { id: string };

const schema = z.object({
  messId: z.string().min(1, 'messId is required'),
});

export const PATCH = withApiHandler<Params>(async (req: NextRequest, { correlationId, params }) => {
  const session = await requireAdmin(req);
  const { id } = await params!;
  const { messId } = schema.parse(await req.json());
  const result = await AdminService.assignManager(session.sub, id, messId, correlationId);
  return createSuccessResponse(result, result.message);
});

