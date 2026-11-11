import mongoose from 'mongoose';
import { WasteRecordModel, IWasteRecord } from '../models/WasteRecord';
import { MealType } from '../models/Menu';

export class WasteRepository {
  static async create(data: Partial<IWasteRecord>): Promise<IWasteRecord> {
    const record = new WasteRecordModel(data);
    return await record.save();
  }

  static async findByMealDateIngredient(
    messId: string | mongoose.Types.ObjectId,
    serviceDate: string,
    mealType: MealType,
    ingredient: string
  ): Promise<IWasteRecord | null> {
    return WasteRecordModel.findOne({ messId, serviceDate, mealType, ingredient }).exec();
  }

  static async listRange(
    messId: string | mongoose.Types.ObjectId,
    fromDate: string,
    toDate: string
  ): Promise<IWasteRecord[]> {
    return WasteRecordModel.find({
      messId,
      serviceDate: { $gte: fromDate, $lte: toDate },
    })
      .sort({ serviceDate: 1, mealType: 1 })
      .exec();
  }
}

