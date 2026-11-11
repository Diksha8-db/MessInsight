import mongoose from 'mongoose';
import { MenuModel, IMenu, MenuStatus, MealType } from '../models/Menu';

export class MenuRepository {
  static async create(data: Partial<IMenu>): Promise<IMenu> {
    const menu = new MenuModel({ ...data, version: 1, isDeleted: false });
    return await menu.save();
  }

  static async findById(id: string | mongoose.Types.ObjectId, messId?: string | mongoose.Types.ObjectId): Promise<IMenu | null> {
    const query: Record<string, unknown> = { _id: id, isDeleted: false };
    if (messId) query.messId = messId;
    return MenuModel.findOne(query).exec();
  }

  static async findByMealAndDate(
    messId: string | mongoose.Types.ObjectId,
    serviceDate: string,
    mealType: MealType,
    includeDeleted = false
  ): Promise<IMenu | null> {
    const query: Record<string, unknown> = {
      messId,
      serviceDate,
      mealType,
      ...(includeDeleted ? {} : { isDeleted: false }),
    };
    return MenuModel.findOne(query).exec();
  }

  static async findPublishedWeekly(
    messId: string | mongoose.Types.ObjectId,
    startDate: string,
    endDate: string
  ): Promise<IMenu[]> {
    return MenuModel.find({
      messId,
      serviceDate: { $gte: startDate, $lte: endDate },
      status: MenuStatus.PUBLISHED,
      isDeleted: false,
    })
      .sort({ serviceDate: 1, mealType: 1 })
      .exec();
  }

  static async list(
    messId: string | mongoose.Types.ObjectId,
    filter: { status?: MenuStatus; fromDate?: string; toDate?: string; page?: number; limit?: number } = {}
  ): Promise<{ menus: IMenu[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { messId, isDeleted: false };
    if (filter.status) query.status = filter.status;
    if (filter.fromDate || filter.toDate) {
      const dateFilter: Record<string, string> = {};
      if (filter.fromDate) dateFilter.$gte = filter.fromDate;
      if (filter.toDate) dateFilter.$lte = filter.toDate;
      query.serviceDate = dateFilter;
    }

    const [menus, total] = await Promise.all([
      MenuModel.find(query).sort({ serviceDate: -1, mealType: 1 }).skip(skip).limit(limit).exec(),
      MenuModel.countDocuments(query).exec(),
    ]);

    return {
      menus,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Optimistic Concurrency Control:
   * Only updates if the version in the database strictly matches expectedVersion.
   * Increments version upon successful update.
   */
  static async updateWithVersion(
    id: string | mongoose.Types.ObjectId,
    messId: string | mongoose.Types.ObjectId,
    expectedVersion: number,
    updateData: Partial<IMenu>
  ): Promise<IMenu | null> {
    return MenuModel.findOneAndUpdate(
      { _id: id, messId, version: expectedVersion, isDeleted: false },
      {
        ...updateData,
        $inc: { version: 1 },
      },
      { returnDocument: 'after', runValidators: true }
    ).exec();
  }

  static async softDelete(
    id: string | mongoose.Types.ObjectId,
    messId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    const res = await MenuModel.updateOne(
      { _id: id, messId, isDeleted: false },
      { $set: { isDeleted: true } }
    ).exec();
    return res.modifiedCount > 0;
  }
}

