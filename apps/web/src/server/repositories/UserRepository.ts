import mongoose from 'mongoose';
import { UserModel, IUser, UserRole } from '../models/User';

export interface UserListFilter {
  role?: UserRole;
  isBlocked?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export class UserRepository {
  static async create(data: Partial<IUser>): Promise<IUser> {
    if (data.instituteEmail) {
      data.instituteEmail = data.instituteEmail.toLowerCase().trim();
    }
    const user = new UserModel(data);
    return await user.save();
  }

  static async findById(id: string | mongoose.Types.ObjectId): Promise<IUser | null> {
    return UserModel.findById(id).exec();
  }

  static async findByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ instituteEmail: email.toLowerCase().trim() }).exec();
  }

  static async list(filter: UserListFilter = {}): Promise<{ users: IUser[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (filter.role) {
      query.role = filter.role;
    }
    if (filter.isBlocked !== undefined) {
      query.isBlocked = filter.isBlocked;
    }
    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      query.$or = [{ name: searchRegex }, { instituteEmail: searchRegex }];
    }

    const [users, total] = await Promise.all([
      UserModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      UserModel.countDocuments(query).exec(),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async update(id: string | mongoose.Types.ObjectId, updateData: Record<string, unknown>): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, updateData, { returnDocument: 'after', runValidators: true }).exec();
  }

  /**
   * Safe PII Anonymization for user deletion: preserves references in feedback/attendance
   * while clearing all personal identifying information.
   */
  static async anonymize(id: string | mongoose.Types.ObjectId): Promise<IUser | null> {
    const anonymizedEmail = `deleted_${id}@anonymized.local`;
    return UserModel.findByIdAndUpdate(
      id,
      {
        name: 'Anonymized User',
        instituteEmail: anonymizedEmail,
        passwordHash: '[ANONYMIZED]',
        isBlocked: true,
        otpHash: null,
        otpExpiresAt: null,
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' }
    ).exec();
  }

  static async bumpTokenVersion(id: string | mongoose.Types.ObjectId): Promise<void> {
    await UserModel.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }).exec();
  }
}

