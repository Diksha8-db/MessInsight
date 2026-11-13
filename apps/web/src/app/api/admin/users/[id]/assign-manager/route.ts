import { NextRequest } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAdmin } from '@/server/middleware/guards';
import { AdminService } from '@/server/services/adminService';

type Params = { id: string };

const schema = z.object({
  // Accept a provided messId or generate a fresh one automatically
  messId: z.string().optional(),
});

export const PATCH = withApiHandler<Params>(async (req: NextRequest, { correlationId, params }) => {
  const session = await requireAdmin(req);
  const { id } = await params!;
  const body = schema.parse(await req.json());
  // Auto-generate a MongoDB ObjectId if no messId provided
  const messId = body.messId && body.messId.length === 24
    ? body.messId
    : new mongoose.Types.ObjectId().toString();
  const result = await AdminService.assignManager(session.sub, id, messId, correlationId);
  return createSuccessResponse(result, result.message);
});

