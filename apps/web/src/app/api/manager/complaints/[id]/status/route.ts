import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireManager, requireMessScope } from '@/server/middleware/guards';
import { ComplaintService } from '@/server/services/complaintService';
import { updateComplaintStatusSchema } from '@/server/validators/complaintValidators';
import { AppError, ErrorCode } from '@/server/lib/errors';

export const PATCH = withApiHandler<{ id: string }>(async (req: NextRequest, { params, correlationId }) => {
  const session = await requireManager(req);
  const { id } = await (params ?? Promise.resolve({ id: '' }));
  const body = await req.json();
  const input = updateComplaintStatusSchema.parse(body);

  if (!session.messId && session.role !== 'ADMIN') {
    throw AppError.forbidden('Manager has no assigned mess', ErrorCode.FORBIDDEN);
  }

  // Find complaint to verify mess scope
  const complaint = await ComplaintService.getComplaintById(id, {});
  if (session.messId) {
    requireMessScope(session, complaint.messId.toString());
  }

  const updated = await ComplaintService.updateStatus(
    id,
    complaint.messId.toString(),
    session.sub,
    input,
    correlationId
  );

  return createSuccessResponse(updated, 'Complaint status updated successfully');
});
