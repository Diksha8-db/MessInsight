import { z } from 'zod';
import { MealType } from '../models/Menu';

// ── Date helpers ──────────────────────────────────────────────────────────────
const serviceDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'serviceDate must be YYYY-MM-DD format')
  .refine((d) => !isNaN(new Date(d).getTime()), 'serviceDate must be a valid calendar date');

// ── Dish item ─────────────────────────────────────────────────────────────────
const dishItemSchema = z.object({
  name: z
    .string()
    .min(1, 'Dish name is required')
    .max(100, 'Dish name cannot exceed 100 characters')
    .trim(),
  category: z
    .string()
    .max(50)
    .trim()
    .default('MAIN_COURSE'),
  isAvailable: z.boolean().default(true),
});

// ── Create / Update menu ──────────────────────────────────────────────────────
export const createMenuSchema = z.object({
  serviceDate: serviceDateSchema,
  mealType: z.nativeEnum(MealType),
  dishes: z.array(dishItemSchema).min(0).default([]),
});

export const updateMenuSchema = z.object({
  dishes: z.array(dishItemSchema).optional(),
  version: z.number().int().min(1, 'version is required for optimistic concurrency'),
});

// ── Publish ───────────────────────────────────────────────────────────────────
export const publishMenuSchema = z.object({
  menuId: z.string().min(1, 'menuId is required'),
  version: z.number().int().min(1).default(1),
  allowBackfill: z.boolean().default(false),
});

// ── Dish availability toggle ──────────────────────────────────────────────────
export const dishAvailabilitySchema = z.object({
  dishName: z.string().min(1),
  isAvailable: z.boolean(),
  version: z.number().int().min(1),
});

// ── List query ────────────────────────────────────────────────────────────────
export const menuListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  fromDate: serviceDateSchema.optional(),
  toDate: serviceDateSchema.optional(),
});

export type CreateMenuInput = z.infer<typeof createMenuSchema>;
export type UpdateMenuInput = z.infer<typeof updateMenuSchema>;
export type PublishMenuInput = z.infer<typeof publishMenuSchema>;
export type DishAvailabilityInput = z.infer<typeof dishAvailabilitySchema>;

