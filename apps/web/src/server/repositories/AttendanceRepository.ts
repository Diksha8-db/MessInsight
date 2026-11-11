import mongoose from 'mongoose';
import { AttendanceRecordModel, IAttendanceRecord } from '../models/AttendanceRecord';
import { MealType } from '../models/Menu';

export class AttendanceRepository {
  static async create(data: Partial<IAttendanceRecord>): Promise<IAttendanceRecord> {
    const record = new AttendanceRecordModel(data);
    return await record.save();
  }

  static async findByMealAndDate(
    messId: string | mongoose.Types.ObjectId,
    serviceDate: string,
    mealType: MealType
  ): Promise<IAttendanceRecord | null> {
    return AttendanceRecordModel.findOne({ messId, serviceDate, mealType }).exec();
  }

  static async listRange(
    messId: string | mongoose.Types.ObjectId,
    fromDate: string,
    toDate: string
  ): Promise<IAttendanceRecord[]> {
    return AttendanceRecordModel.find({
      messId,
      serviceDate: { $gte: fromDate, $lte: toDate },
    })
      .sort({ serviceDate: 1, mealType: 1 })
      .exec();
  }

  static async update(
    id: string | mongoose.Types.ObjectId,
    messId: string | mongoose.Types.ObjectId,
    actualAttendance: number,
    recordedBy: string | mongoose.Types.ObjectId
  ): Promise<IAttendanceRecord | null> {
    return AttendanceRecordModel.findOneAndUpdate(
      { _id: id, messId },
      {
        $set: {
          actualAttendance,
          recordedBy,
          isManualEdit: true,
        },
      },
      { returnDocument: 'after', runValidators: true }
    ).exec();
  }
}

