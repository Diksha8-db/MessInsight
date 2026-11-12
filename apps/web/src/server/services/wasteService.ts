import mongoose from 'mongoose';
import { connectDb } from '../lib/db';
import { WasteRepository } from '../repositories/WasteRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { RecordWasteInput } from '../validators/wasteValidators';
import { IWasteRecord, WasteRecordModel } from '../models/WasteRecord';

export class WasteService {
  /**
   * Record or update waste record for mess+date+meal+ingredient.
   */
  static async recordWaste(
    messId: string,
    managerId: string,
    input: RecordWasteInput,
    correlationId: string
  ): Promise<IWasteRecord> {
    await connectDb();

    const {
      serviceDate,
      mealType,
      ingredient,
      preparedQuantity,
      consumedQuantity,
      leftoverQuantity,
      unit,
    } = input;

    const unaccountedDiff = Number(
      (preparedQuantity - (consumedQuantity + leftoverQuantity)).toFixed(4)
    );

    const filter = {
      messId: new mongoose.Types.ObjectId(messId),
      serviceDate,
      mealType,
      ingredient: ingredient.trim(),
    };

    const updateDoc = {
      $set: {
        preparedQuantity,
        consumedQuantity,
        leftoverQuantity,
        unaccountedDiff,
        unit,
        recordedBy: new mongoose.Types.ObjectId(managerId),
      },
    };

    const record = await WasteRecordModel.findOneAndUpdate(filter, updateDoc, {
      new: true,
      upsert: true,
      runValidators: true,
    });

    if (!record) {
      throw AppError.internal('Failed to record waste.');
    }

    await AuditLogRepository.log(
      managerId,
      'WASTE_RECORDED',
      'WasteRecord',
      correlationId,
      `Recorded waste for ${ingredient} (${serviceDate} ${mealType}): prep=${preparedQuantity}, left=${leftoverQuantity}`,
      record._id.toString()
    );

    logger.info(
      `Waste recorded: messId=${messId} date=${serviceDate} meal=${mealType} ingredient=${ingredient}`,
      correlationId,
      { wasteId: record._id.toString() }
    );

    return record;
  }

  /**
   * List waste records for date range.
   */
  static async listWaste(
    messId: string,
    from: string,
    to: string,
    correlationId: string
  ): Promise<IWasteRecord[]> {
    await connectDb();

    if (from > to) {
      throw AppError.unprocessable(
        '"from" date must be before or equal to "to" date.',
        ErrorCode.INVALID_DATE_RANGE
      );
    }

    const records = await WasteRepository.listRange(messId, from, to);
    logger.info(
      `Waste listed: messId=${messId} from=${from} to=${to} count=${records.length}`,
      correlationId
    );
    return records;
  }
}

