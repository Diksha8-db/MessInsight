import mongoose from 'mongoose';
import { ComplaintModel, IComplaint, ComplaintStatus, ComplaintPriority } from '../models/Complaint';

export class ComplaintRepository {
  static async create(data: Partial<IComplaint>): Promise<IComplaint> {
    const complaint = new ComplaintModel(data);
    return await complaint.save();
  }

  static async findById(
    id: string | mongoose.Types.ObjectId,
    scope?: { messId?: string | mongoose.Types.ObjectId; studentId?: string | mongoose.Types.ObjectId }
  ): Promise<IComplaint | null> {
    const query: Record<string, unknown> = { _id: id };
    if (scope?.messId) query.messId = scope.messId;
    if (scope?.studentId) query.studentId = scope.studentId;
    return ComplaintModel.findOne(query).exec();
  }

  static async list(
    filter: {
      messId?: string | mongoose.Types.ObjectId;
      studentId?: string | mongoose.Types.ObjectId;
      status?: ComplaintStatus;
      priority?: ComplaintPriority;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ complaints: IComplaint[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (filter.messId) query.messId = filter.messId;
    if (filter.studentId) query.studentId = filter.studentId;
    if (filter.status) query.status = filter.status;
    if (filter.priority) query.priority = filter.priority;

    const [complaints, total] = await Promise.all([
      ComplaintModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      ComplaintModel.countDocuments(query).exec(),
    ]);

    return {
      complaints,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async updateStatus(
    id: string | mongoose.Types.ObjectId,
    messId: string | mongoose.Types.ObjectId,
    newStatus: ComplaintStatus,
    changedById: string | mongoose.Types.ObjectId,
    note?: string
  ): Promise<IComplaint | null> {
    const update: Record<string, unknown> = {
      $set: { status: newStatus },
      $push: {
        history: {
          status: newStatus,
          changedBy: changedById,
          note: note || '',
          timestamp: new Date(),
        },
      },
    };

    if (newStatus === ComplaintStatus.RESOLVED) {
      (update.$set as Record<string, unknown>).resolvedAt = new Date();
    }

    return ComplaintModel.findOneAndUpdate({ _id: id, messId }, update, { returnDocument: 'after' }).exec();
  }
}

