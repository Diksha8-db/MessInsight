import { z } from 'zod';
import { ComplaintCategory, ComplaintPriority, ComplaintStatus } from '../models/Complaint';

export const createComplaintSchema = z.object({
  messId: z.string().min(1, 'messId is required'),
  category: z.nativeEnum(ComplaintCategory),
  priority: z.nativeEnum(ComplaintPriority).default(ComplaintPriority.MEDIUM),
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150, 'Title cannot exceed 150 characters'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000, 'Description cannot exceed 2000 characters'),
  imageUrl: z.string().url().optional().nullable(),
  feedbackId: z.string().optional().nullable(),
});

export const updateComplaintStatusSchema = z.object({
  status: z.nativeEnum(ComplaintStatus),
  managerResponse: z.string().max(2000).optional(),
  note: z.string().max(500).optional(),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;
export type UpdateComplaintStatusInput = z.infer<typeof updateComplaintStatusSchema>;

