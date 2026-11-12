import { z } from 'zod';
import { MealType } from '../models/Menu';
import { AllowedUnit } from '../models/WasteRecord';

export const recordWasteSchema = z
  .object({
    serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'serviceDate must be YYYY-MM-DD'),
    mealType: z.nativeEnum(MealType),
    ingredient: z.string().trim().min(1, 'Ingredient name is required'),
    preparedQuantity: z.number().min(0, 'Prepared quantity cannot be negative'),
    consumedQuantity: z.number().min(0, 'Consumed quantity cannot be negative'),
    leftoverQuantity: z.number().min(0, 'Leftover quantity cannot be negative'),
    unit: z.nativeEnum(AllowedUnit),
  })
  .refine((data) => data.leftoverQuantity <= data.preparedQuantity, {
    message: 'Leftover quantity cannot exceed prepared quantity',
    path: ['leftoverQuantity'],
  })
  .refine((data) => data.consumedQuantity <= data.preparedQuantity, {
    message: 'Consumed quantity cannot exceed prepared quantity',
    path: ['consumedQuantity'],
  });

export type RecordWasteInput = z.infer<typeof recordWasteSchema>;

