import mongoose from 'mongoose';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { INotification } from '../models/Notification';
import { logger } from '../lib/logger';

export class NotificationService {
  /**
   * Create a notification with eventKey deduplication.
   */
  static async sendNotification(data: {
    userId: string | mongoose.Types.ObjectId;
    title: string;
    message: string;
    eventKey: string;
    linkUrl?: string;
  }): Promise<INotification | null> {
    try {
      return await NotificationRepository.create({
        userId: new mongoose.Types.ObjectId(data.userId),
        title: data.title,
        message: data.message,
        eventKey: data.eventKey,
        linkUrl: data.linkUrl,
        isRead: false,
      });
    } catch (err: any) {
      // Duplicate eventKey (code 11000) is ignored gracefully
      if (err.code === 11000) {
        logger.info('Duplicate notification prevented by eventKey', undefined, { eventKey: data.eventKey });
        return null;
      }
      logger.error('Failed to create notification', undefined, { error: err.message, userId: data.userId.toString() });
      return null;
    }
  }

  static async getUserNotifications(userId: string, page = 1, limit = 20) {
    return NotificationRepository.listUser(userId, page, limit);
  }

  static async markNotificationRead(id: string, userId: string): Promise<boolean> {
    return NotificationRepository.markRead(id, userId);
  }

  static async markAllNotificationsRead(userId: string): Promise<number> {
    return NotificationRepository.markAllRead(userId);
  }
}
