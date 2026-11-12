import { z } from 'zod';

export const dishRatingSchema = z.object({
  dishId: z.string().min(1, 'dishId is required'),
  rating: z.number().int().min(1).max(5),
});

export const createFeedbackSchema = z.object({
  menuId: z.string().min(1, 'menuId is required'),
  overallRating: z.number().int().min(1, 'Overall rating must be between 1 and 5').max(5, 'Overall rating must be between 1 and 5'),
  dishRatings: z.array(dishRatingSchema).default([]),
  comments: z.string().max(1000, 'Comments cannot exceed 1000 characters').optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  isAnonymous: z.boolean().default(false),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export const updateFeedbackSchema = z.object({
  overallRating: z.number().int().min(1).max(5).optional(),
  dishRatings: z.array(dishRatingSchema).optional(),
  comments: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  isAnonymous: z.boolean().optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;

