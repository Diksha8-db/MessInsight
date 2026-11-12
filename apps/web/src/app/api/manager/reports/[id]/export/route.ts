import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { requireManager } from '@/server/middleware/guards';
import { ReportService } from '@/server/services/reportService';

export const GET = withApiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  await requireManager(req);
  const resolvedParams = await (params ?? Promise.resolve({ id: '' }));
  const id = resolvedParams.id;

  const { filename, csv } = await ReportService.exportCsv(id);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

