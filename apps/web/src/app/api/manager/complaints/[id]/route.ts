import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { ComplaintService } from '@/server/services/complaintService';

export const GET = withApiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireManager(req);
  const { id } = await (params ?? Promise.resolve({ id: '' }));

  // Fetch complaint first to check its messId against manager's mess scope
  const complaint = await ComplaintService.getComplaintById(id, {
    messId: session.messId,
  });

  if (session.messId) {
    requireMessScope(session, complaint.messId.toString());
  }

  return createSuccessResponse(complaint, 'Complaint details retrieved');
});
