import { NextRequest } from 'next/server';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireStudent } from '@/server/middleware/guards';
import { ComplaintService } from '@/server/services/complaintService';
import { createComplaintSchema } from '@/server/validators/complaintValidators';

export const POST = withApiHandler(async (req: NextRequest, { correlationId }) => {
  const session = await requireStudent(req);
  const body = await req.json();
  const input = createComplaintSchema.parse(body);

  const complaint = await ComplaintService.createComplaint(session.sub, input, correlationId);
  return createSuccessResponse(complaint, 'Complaint submitted successfully', 201);
});

export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireStudent(req);
  const searchParams = req.nextUrl.searchParams;
  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '20');

  const result = await ComplaintService.listStudentComplaints(session.sub, page, limit);
  return createSuccessResponse(result, 'Complaints retrieved');
});

