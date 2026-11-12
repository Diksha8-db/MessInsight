import mongoose from 'mongoose';
import { FeedbackRepository } from '../repositories/FeedbackRepository';
import { MenuRepository } from '../repositories/MenuRepository';
import { IFeedback, ModerationStatus, SentimentLabel, SentimentStatus } from '../models/Feedback';
import { MenuStatus } from '../models/Menu';
import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { CreateFeedbackInput, UpdateFeedbackInput } from '../validators/feedbackValidators';
import { NotificationService } from './notificationService';
import { NlpService } from './nlpService';
import { FeedbackModel } from '../models/Feedback';

const EDIT_WINDOW_HOURS = 24;

const ABUSE_KEYWORDS = ['bastard', 'asshole', 'fuck', 'shit', 'scam', 'poison'];

function checkAbuse(text?: string | null): ModerationStatus {
  if (!text) return ModerationStatus.OK;
  const lower = text.toLowerCase();
  for (const word of ABUSE_KEYWORDS) {
    if (lower.includes(word)) {
      return ModerationStatus.FLAGGED;
    }
  }
  return ModerationStatus.OK;
}

export class FeedbackService {
  /**
   * Submit new student feedback for a published menu.
   */
  static async submitFeedback(
    studentId: string,
    input: CreateFeedbackInput,
    correlationId: string
  ): Promise<IFeedback> {
    const studentObjId = new mongoose.Types.ObjectId(studentId);
    const menuObjId = new mongoose.Types.ObjectId(input.menuId);

    // 1. Idempotency check: if key supplied, return existing record if present
    if (input.idempotencyKey) {
      const existingKey = await FeedbackModel.findOne({
        studentId: studentObjId,
        idempotencyKey: input.idempotencyKey,
        isDeleted: false,
      }).exec();
      if (existingKey) {
        logger.info('Returning idempotent feedback response', correlationId, { idempotencyKey: input.idempotencyKey });
        return existingKey;
      }
    }

    // 2. Verify menu exists and is PUBLISHED
    const menu = await MenuRepository.findById(menuObjId);
    if (!menu || menu.isDeleted) {
      throw AppError.notFound('Menu not found.', ErrorCode.NOT_FOUND);
    }
    if (menu.status !== MenuStatus.PUBLISHED) {
      throw AppError.badRequest('Feedback can only be submitted for published menus.', ErrorCode.BAD_REQUEST);
    }

    // 3. Check for existing feedback for this (student, menu)
    const existing = await FeedbackRepository.findByStudentAndMenu(studentObjId, menuObjId);
    if (existing) {
      throw AppError.conflict(
        'You have already submitted feedback for this meal.',
        ErrorCode.CONFLICT
      );
    }

    // 4. Validate dish ratings against menu dishes
    const menuDishesMap = new Map<string, { isAvailable: boolean; name: string }>();
    for (const d of menu.dishes) {
      const idStr = (d.dishId || (d as any)._id)?.toString();
      if (idStr) menuDishesMap.set(idStr, { isAvailable: d.isAvailable, name: d.name });
    }

    if (input.dishRatings && input.dishRatings.length > 0) {
      for (const dr of input.dishRatings) {
        const dish = menuDishesMap.get(dr.dishId);
        if (!dish) {
          throw AppError.badRequest(`Dish ${dr.dishId} does not belong to this menu.`, ErrorCode.BAD_REQUEST);
        }
        if (!dish.isAvailable) {
          throw AppError.badRequest(`Dish "${dish.name}" was marked unavailable and cannot be rated.`, ErrorCode.BAD_REQUEST);
        }
      }
    }

    // 5. Clean comments and check moderation
    const cleanComments = input.comments?.trim() || undefined;
    const moderationStatus = checkAbuse(cleanComments);

    // 6. Create feedback record
    const feedback = await FeedbackRepository.create({
      studentId: studentObjId,
      menuId: menuObjId,
      messId: menu.messId,
      serviceDate: menu.serviceDate,
      mealType: menu.mealType,
      overallRating: input.overallRating,
      dishRatings: input.dishRatings.map((dr) => ({
        dishId: new mongoose.Types.ObjectId(dr.dishId),
        rating: dr.rating,
      })),
      comments: cleanComments,
      imageUrl: input.imageUrl || undefined,
      isAnonymous: input.isAnonymous || false,
      idempotencyKey: input.idempotencyKey,
      moderationStatus,
      sentiment: {
        label: SentimentLabel.UNCERTAIN,
        score: 0,
        confidence: 0,
        status: SentimentStatus.PENDING,
        modelVersion: 'stub-v0',
      },
      dishesMentioned: [],
      issues: [],
    });

    // 7. Send confirmation notification (non-blocking)
    NotificationService.sendNotification({
      userId: studentObjId,
      title: 'Feedback Received',
      message: `Your feedback for ${menu.mealType} on ${menu.serviceDate} has been recorded. Thank you!`,
      eventKey: `feedback-confirm-${feedback._id}`,
    }).catch((err) => logger.warn('Failed to send feedback confirmation notification', correlationId, { err: err.message }));

    // 8. Fire-and-forget NLP sentiment analysis
    const dishNames = (menu.dishes || []).map((d) => d.name);
    NlpService.analyzeFeedbackSentiment(
      feedback._id.toString(),
      cleanComments || '',
      dishNames,
      menu.messId.toString(),
      correlationId
    ).catch((err) =>
      logger.warn('Failed to process sentiment asynchronously', correlationId, { err: err?.message })
    );

    logger.info('Feedback submitted successfully', correlationId, {
      feedbackId: feedback._id.toString(),
      isAnonymous: feedback.isAnonymous,
    });

    return feedback;
  }

  /**
   * Edit feedback within the allowed edit window.
   */
  static async updateFeedback(
    feedbackId: string,
    studentId: string,
    input: UpdateFeedbackInput,
    correlationId: string
  ): Promise<IFeedback> {
    const feedback = await FeedbackRepository.findById(feedbackId, studentId);
    if (!feedback) {
      throw AppError.notFound('Feedback record not found.', ErrorCode.NOT_FOUND);
    }

    // Server-enforced edit window check
    const diffHours = (Date.now() - feedback.createdAt.getTime()) / (1000 * 60 * 60);
    if (diffHours > EDIT_WINDOW_HOURS) {
      throw AppError.forbidden(
        `Feedback can only be edited within ${EDIT_WINDOW_HOURS} hours of submission.`,
        ErrorCode.EDIT_WINDOW_CLOSED
      );
    }

    const updateData: Partial<IFeedback> = {};
    if (input.overallRating !== undefined) updateData.overallRating = input.overallRating;
    if (input.isAnonymous !== undefined) updateData.isAnonymous = input.isAnonymous;
    if (input.comments !== undefined) {
      updateData.comments = input.comments?.trim() || undefined;
      updateData.moderationStatus = checkAbuse(updateData.comments);
    }
    if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl || undefined;

    const updated = await FeedbackRepository.update(feedbackId, studentId, updateData);
    if (!updated) {
      throw AppError.notFound('Feedback could not be updated.', ErrorCode.NOT_FOUND);
    }

    logger.info('Feedback updated', correlationId, { feedbackId });
    return updated;
  }

  /**
   * Soft delete feedback.
   */
  static async deleteFeedback(feedbackId: string, studentId: string): Promise<boolean> {
    const success = await FeedbackRepository.softDelete(feedbackId, studentId);
    if (!success) {
      throw AppError.notFound('Feedback record not found.', ErrorCode.NOT_FOUND);
    }
    return true;
  }

  /**
   * List a student's own feedback history.
   */
  static async getStudentHistory(studentId: string, page = 1, limit = 20) {
    return FeedbackRepository.listStudentHistory(studentId, page, limit);
  }

  /**
   * Get single feedback detail (ensuring ownership for students).
   */
  static async getFeedbackById(feedbackId: string, studentId: string) {
    const feedback = await FeedbackRepository.findById(feedbackId, studentId);
    if (!feedback) {
      throw AppError.notFound('Feedback record not found.', ErrorCode.NOT_FOUND);
    }
    return feedback;
  }

  /**
   * List feedback for manager (strictly strips studentId for anonymous feedback).
   */
  static async getMessFeedback(
    messId: string,
    filter: { serviceDate?: string; mealType?: string; page?: number; limit?: number }
  ) {
    return FeedbackRepository.listMessFeedback(messId, filter);
  }
}
