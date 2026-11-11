import mongoose from 'mongoose';
import { DishModel, IDish, DishCategory } from '../models/Dish';

export class DishRepository {
  static async create(data: Partial<IDish>): Promise<IDish> {
    const dish = new DishModel({ ...data, isDeleted: false });
    return await dish.save();
  }

  static async findById(id: string | mongoose.Types.ObjectId, messId: string | mongoose.Types.ObjectId): Promise<IDish | null> {
    return DishModel.findOne({ _id: id, messId, isDeleted: false }).exec();
  }

  static async list(
    messId: string | mongoose.Types.ObjectId,
    filter: { category?: DishCategory; isAvailable?: boolean; search?: string } = {}
  ): Promise<IDish[]> {
    const query: Record<string, unknown> = { messId, isDeleted: false };
    if (filter.category) query.category = filter.category;
    if (filter.isAvailable !== undefined) query.isAvailable = filter.isAvailable;
    if (filter.search && filter.search.trim()) {
      query.name = new RegExp(filter.search.trim(), 'i');
    }

    return DishModel.find(query).sort({ name: 1 }).exec();
  }

  static async update(
    id: string | mongoose.Types.ObjectId,
    messId: string | mongoose.Types.ObjectId,
    updateData: Partial<IDish>
  ): Promise<IDish | null> {
    return DishModel.findOneAndUpdate(
      { _id: id, messId, isDeleted: false },
      updateData,
      { returnDocument: 'after', runValidators: true }
    ).exec();
  }

  static async setAvailability(
    id: string | mongoose.Types.ObjectId,
    messId: string | mongoose.Types.ObjectId,
    isAvailable: boolean
  ): Promise<IDish | null> {
    return DishModel.findOneAndUpdate(
      { _id: id, messId, isDeleted: false },
      { $set: { isAvailable } },
      { returnDocument: 'after' }
    ).exec();
  }

  static async softDelete(
    id: string | mongoose.Types.ObjectId,
    messId: string | mongoose.Types.ObjectId
  ): Promise<boolean> {
    const res = await DishModel.updateOne(
      { _id: id, messId, isDeleted: false },
      { $set: { isDeleted: true } }
    ).exec();
    return res.modifiedCount > 0;
  }
}

