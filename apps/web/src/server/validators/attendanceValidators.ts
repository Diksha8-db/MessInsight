import { z } from 'zod';
import { MealType } from '../models/Menu';

export const recordAttendanceSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'serviceDate must be YYYY-MM-DD'),
  mealType: z.nativeEnum(MealType),
  actualAttendance: z.number().int().min(0, 'Attendance cannot be negative'),
});

export const updateAttendanceSchema = z.object({
  actualAttendance: z.number().int().min(0, 'Attendance cannot be negative'),
  reason: z.string().max(200).optional(),
});

export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;

