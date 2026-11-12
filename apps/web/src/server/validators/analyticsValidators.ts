import { z } from 'zod';
import { MealType } from '../models/Menu';

export const dateRangeSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
    mealType: z.nativeEnum(MealType).optional(),
  })
  .refine(
    (data) => {
      const fromDate = new Date(data.from);
      const toDate = new Date(data.to);
      return fromDate <= toDate;
    },
    {
      message: '"from" date must be before or equal to "to" date',
      path: ['from'],
    }
  )
  .refine(
    (data) => {
      const fromDate = new Date(data.from);
      const toDate = new Date(data.to);
      const diffDays = Math.ceil(
        (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays <= 366;
    },
    {
      message: 'Date range cannot exceed 366 days',
      path: ['to'],
    }
  );

export type DateRangeInput = z.infer<typeof dateRangeSchema>;

