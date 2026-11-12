import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager } from '@/server/middleware/guards';
import { ReportRepository } from '@/server/repositories/ReportRepository';
import { AppError } from '@/server/lib/errors';
import { connectDb } from '@/server/lib/db';

export const GET = withApiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  await requireManager(req);
  const resolvedParams = await (params ?? Promise.resolve({ id: '' }));
  const id = resolvedParams.id;

  await connectDb();
  const report = await ReportRepository.findById(id);
  if (!report) {
    throw AppError.notFound('Report not found');
  }

  return createSuccessResponse(report, 'Report retrieved');
});

