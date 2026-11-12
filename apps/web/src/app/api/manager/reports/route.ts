import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { ReportService } from '@/server/services/reportService';
import { ReportRepository } from '@/server/repositories/ReportRepository';
import { ReportType } from '@/server/models/Report';
import { AppError } from '@/server/lib/errors';
import { connectDb } from '@/server/lib/db';

const generateReportSchema = z.object({
  type: z.nativeEnum(ReportType),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
});

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  await connectDb();

  const reports = await ReportRepository.list(30);
  return createSuccessResponse(reports, 'Reports retrieved');
});

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireManager(req);
  const body = await req.json();

  const messId = body.messId || session.messId;
  if (!messId) {
    throw AppError.badRequest('messId is required');
  }
  requireMessScope(session, messId);

  const parsed = generateReportSchema.parse(body);
  const report = await ReportService.generateReport(
    {
      type: parsed.type,
      from: parsed.from,
      to: parsed.to,
      messId,
    },
    session.sub,
    correlationId
  );

  return createSuccessResponse(report, 'Report generated successfully', 201);
});

