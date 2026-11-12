import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireStudent } from '@/server/middleware/guards';
import { ComplaintService } from '@/server/services/complaintService';

export const GET = withApiHandler<{ id: string }>(async (req: NextRequest, { params }) => {
  const session = await requireStudent(req);
  const { id } = await (params ?? Promise.resolve({ id: '' }));
  const complaint = await ComplaintService.getComplaintById(id, {
    studentId: session.sub,
  });
  return createSuccessResponse(complaint, 'Complaint details retrieved');
});
