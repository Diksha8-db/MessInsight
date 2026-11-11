import mongoose from 'mongoose';
import { SettingsModel, ISettings } from '../models/Settings';

export class SettingsRepository {
  static async getByMessId(messId: string | mongoose.Types.ObjectId): Promise<ISettings | null> {
    return SettingsModel.findOne({ messId }).exec();
  }

  static async upsert(
    messId: string | mongoose.Types.ObjectId,
    data: Partial<ISettings>
  ): Promise<ISettings> {
    return SettingsModel.findOneAndUpdate(
      { messId },
      { $set: data },
      { returnDocument: 'after', upsert: true, runValidators: true }
    ).exec();
  }
}

