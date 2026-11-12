import mongoose from 'mongoose';
import { PredictionModel, IPrediction } from '../models/Prediction';
import { MealType } from '../models/Menu';

export class PredictionRepository {
  static async create(data: Partial<IPrediction>): Promise<IPrediction> {
    const prediction = new PredictionModel(data);
    return await prediction.save();
  }

  static async findLatest(
    messId: string | mongoose.Types.ObjectId,
    serviceDate: string,
    mealType: MealType
  ): Promise<IPrediction | null> {
    return PredictionModel.findOne({ messId, serviceDate, mealType })
      .sort({ generatedAt: -1 })
      .exec();
  }

  static async findWeekly(
    messId: string | mongoose.Types.ObjectId,
    startDate: string,
    endDate: string
  ): Promise<IPrediction[]> {
    return PredictionModel.find({
      messId,
      serviceDate: { $gte: startDate, $lte: endDate },
    })
      .sort({ serviceDate: 1, mealType: 1, generatedAt: -1 })
      .exec();
  }

  static async listRange(
    messId: string | mongoose.Types.ObjectId,
    fromDate: string,
    toDate: string
  ): Promise<IPrediction[]> {
    return PredictionModel.find({
      messId,
      serviceDate: { $gte: fromDate, $lte: toDate },
    })
      .sort({ serviceDate: 1, mealType: 1, generatedAt: -1 })
      .exec();
  }
}

