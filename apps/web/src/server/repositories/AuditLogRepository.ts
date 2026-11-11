import mongoose from 'mongoose';
import { AuditLogModel, IAuditLog } from '../models/AuditLog';
import { scrubData } from '../lib/logger';

export class AuditLogRepository {
  static async log(
    actorId: string | mongoose.Types.ObjectId,
    action: string,
    targetCollection: string,
    correlationId: string,
    summary: string,
    targetId?: string | mongoose.Types.ObjectId
  ): Promise<IAuditLog> {
    // Strictly scrub summary so secrets, OTPs or passwords are never stored in audit logs
    const safeSummary = scrubData(summary) as string;

    const logEntry = new AuditLogModel({
      actorId,
      action,
      targetCollection,
      targetId,
      correlationId,
      summary: safeSummary,
    });

    return await logEntry.save();
  }

  static async list(page = 1, limit = 50): Promise<{ logs: IAuditLog[]; total: number }> {
    const skip = (Math.max(1, page) - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLogModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      AuditLogModel.countDocuments().exec(),
    ]);

    return { logs, total };
  }
}

