import mongoose from 'mongoose';
import { FeedbackModel, IFeedback } from '../models/Feedback';

export class FeedbackRepository {
  static async create(data: Partial<IFeedback>): Promise<IFeedback> {
    const feedback = new FeedbackModel({ ...data, isDeleted: false });
    return await feedback.save();
  }

  static async findById(
    id: string | mongoose.Types.ObjectId,
    studentId?: string | mongoose.Types.ObjectId
  ): Promise<IFeedback | null> {
    const query: Record<string, unknown> = { _id: id, isDeleted: false };
    if (studentId) query.studentId = studentId;
    return FeedbackModel.findOne(query).exec();
  }

  static async findByStudentAndMenu(
    studentId: string | mongoose.Types.ObjectId,
    menuId: string | mongoose.Types.ObjectId
  ): Promise<IFeedback | null> {
    return FeedbackModel.findOne({ studentId, menuId, isDeleted: false }).exec();
  }

  static async listStudentHistory(
    studentId: string | mongoose.Types.ObjectId,
    page = 1,
    limit = 20
  ): Promise<{ feedback: IFeedback[]; total: number; page: number; totalPages: number }> {
    const skip = (Math.max(1, page) - 1) * limit;
    const query: Record<string, unknown> = { studentId, isDeleted: false };

    const [feedback, total] = await Promise.all([
      FeedbackModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      FeedbackModel.countDocuments(query).exec(),
    ]);

    return {
      feedback,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async listMessFeedback(
    messId: string | mongoose.Types.ObjectId,
    filter: { serviceDate?: string; mealType?: string; page?: number; limit?: number } = {}
  ): Promise<{ feedback: Array<Partial<IFeedback>>; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { messId, isDeleted: false };
    if (filter.serviceDate) query.serviceDate = filter.serviceDate;
    if (filter.mealType) query.mealType = filter.mealType;

    const [items, total] = await Promise.all([
      FeedbackModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      FeedbackModel.countDocuments(query).exec(),
    ]);

    // Anonymize: strictly redact studentId if anonymous
    const sanitizedItems = items.map((item) => {
      if (item.isAnonymous) {
        return { ...item, studentId: undefined };
      }
      return item;
    });

    return {
      feedback: sanitizedItems,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async update(
    id: string | mongoose.Types.ObjectId,
    studentId: string | mongoose.Types.ObjectId,
    updateData: Partial<IFeedback>
  ): Promise<IFeedback | null> {
    return FeedbackModel.findOneAndUpdate(
      { _id: id, studentId, isDeleted: false },
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).exec();
  }

  static async softDelete(
    id: string | mongoose.Types.ObjectId,
    studentId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    const res = await FeedbackModel.updateOne(
      { _id: id, studentId, isDeleted: false },
      { $set: { isDeleted: true } }
    ).exec();
    return res.modifiedCount > 0;
  }

  static async updateSentiment(
    id: string | mongoose.Types.ObjectId,
    sentiment: any,
    dishesMentioned: string[],
    issues: any[]
  ): Promise<IFeedback | null> {
    return FeedbackModel.findByIdAndUpdate(
      id,
      {
        $set: {
          sentiment,
          dishesMentioned,
          issues,
        },
      },
      { returnDocument: 'after' }
    ).exec();
  }
}

