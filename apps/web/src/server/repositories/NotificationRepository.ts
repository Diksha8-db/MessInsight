import mongoose from 'mongoose';
import { NotificationModel, INotification } from '../models/Notification';

export class NotificationRepository {
  static async create(data: Partial<INotification>): Promise<INotification> {
    const notification = new NotificationModel(data);
    return await notification.save();
  }

  static async listUser(
    userId: string | mongoose.Types.ObjectId,
    page = 1,
    limit = 20
  ): Promise<{ notifications: INotification[]; total: number; unreadCount: number }> {
    const skip = (Math.max(1, page) - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      NotificationModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      NotificationModel.countDocuments({ userId }).exec(),
      NotificationModel.countDocuments({ userId, isRead: false }).exec(),
    ]);

    return {
      notifications,
      total,
      unreadCount,
    };
  }

  static async markRead(
    id: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    const res = await NotificationModel.updateOne({ _id: id, userId }, { $set: { isRead: true } }).exec();
    return res.modifiedCount > 0;
  }

  static async markAllRead(userId: string | mongoose.Types.ObjectId): Promise<number> {
    const res = await NotificationModel.updateMany({ userId, isRead: false }, { $set: { isRead: true } }).exec();
    return res.modifiedCount;
  }
}

