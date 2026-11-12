import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/server/lib/apiHandler';
import { createSuccessResponse } from '@/server/lib/response';
import { requireAuth } from '@/server/middleware/guards';
import { MenuService } from '@/server/services/menuService';
import { AppError, ErrorCode } from '@/server/lib/errors';

const querySchema = z.object({
  messId: z.string().min(1, 'messId is required'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD')
    .optional(),
});

export const GET = withApiHandler(async (req: NextRequest, { correlationId }) => {
  await requireAuth(req);
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { messId, startDate } = querySchema.parse(params);

  // Default startDate to today (mess timezone)
  const resolvedStart =
    startDate ||
    new Date()
      .toLocaleDateString('en-CA', { timeZone: process.env.MESS_TIMEZONE || 'Asia/Kolkata' })
      .slice(0, 10);

  const weekly = await MenuService.getWeeklyMenu(messId, resolvedStart);
  return createSuccessResponse(weekly, 'Weekly menu retrieved');
});

