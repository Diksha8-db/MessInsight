import { z } from 'zod';
import { MealType } from '../models/Menu';

export const generatePredictionSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'serviceDate must be YYYY-MM-DD'),
  mealType: z.nativeEnum(MealType),
  capacity: z.number().int().min(1).default(1000),
});

export const generateWeeklyPredictionSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  capacity: z.number().int().min(1).default(1000),
});

export const servingStandardItemSchema = z.object({
  amountPerPerson: z.number().gt(0, 'amountPerPerson must be positive'),
  unit: z.enum(['kg', 'g', 'l', 'ml', 'count']),
});

export const recommendQuantitySchema = z.object({
  predictedAttendance: z.number().int().min(0),
  servingStandards: z.record(z.string(), servingStandardItemSchema),
  safetyBuffer: z.number().min(0).max(0.5).default(0.1),
  inventory: z.record(z.string(), z.number()).optional(),
});

export type GeneratePredictionInput = z.infer<typeof generatePredictionSchema>;
export type GenerateWeeklyPredictionInput = z.infer<typeof generateWeeklyPredictionSchema>;
export type RecommendQuantityInput = z.infer<typeof recommendQuantitySchema>;

