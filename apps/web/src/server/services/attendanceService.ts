import { connectDb } from '../lib/db';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { RecordAttendanceInput } from '../validators/attendanceValidators';
import { IAttendanceRecord } from '../models/AttendanceRecord';
import mongoose from 'mongoose';

export class AttendanceService {
  /**
   * Record or update attendance for a mess+date+meal combo.
   * Upsert: if a record already exists, update it; otherwise create.
   */
  static async recordAttendance(
    messId: string,
    managerId: string,
    input: RecordAttendanceInput,
    correlationId: string
  ): Promise<IAttendanceRecord> {
    await connectDb();

    const { serviceDate, mealType, actualAttendance } = input;

    // Check for existing record
    const existing = await AttendanceRepository.findByMealAndDate(messId, serviceDate, mealType);

    let record: IAttendanceRecord;

    if (existing) {
      // Update existing record
      const updated = await AttendanceRepository.update(
        existing._id.toString(),
        messId,
        actualAttendance,
        managerId
      );
      if (!updated) {
        throw AppError.internal('Failed to update attendance record.');
      }
      record = updated;

      await AuditLogRepository.log(
        managerId,
        'ATTENDANCE_UPDATED',
        'AttendanceRecord',
        correlationId,
        `Updated ${mealType} attendance for ${serviceDate}: ${actualAttendance}`,
        existing._id.toString()
      );

      logger.info(
        `Attendance updated: messId=${messId} date=${serviceDate} meal=${mealType} count=${actualAttendance}`,
        correlationId,
        { attendanceId: record._id.toString() }
      );
    } else {
      // Create new record
      record = await AttendanceRepository.create({
        messId: new mongoose.Types.ObjectId(messId),
        serviceDate,
        mealType,
        actualAttendance,
        recordedBy: new mongoose.Types.ObjectId(managerId),
        isManualEdit: false,
      });

      await AuditLogRepository.log(
        managerId,
        'ATTENDANCE_RECORDED',
        'AttendanceRecord',
        correlationId,
        `Recorded ${mealType} attendance for ${serviceDate}: ${actualAttendance}`,
        record._id.toString()
      );

      logger.info(
        `Attendance recorded: messId=${messId} date=${serviceDate} meal=${mealType} count=${actualAttendance}`,
        correlationId,
        { attendanceId: record._id.toString() }
      );
    }

    return record;
  }

  /**
   * List attendance records for a date range.
   */
  static async listAttendance(
    messId: string,
    from: string,
    to: string,
    correlationId: string
  ): Promise<IAttendanceRecord[]> {
    await connectDb();

    if (from > to) {
      throw AppError.unprocessable(
        '"from" date must be before or equal to "to" date.',
        ErrorCode.INVALID_DATE_RANGE
      );
    }

    const records = await AttendanceRepository.listRange(messId, from, to);
    logger.info(
      `Attendance listed: messId=${messId} from=${from} to=${to} count=${records.length}`,
      correlationId
    );
    return records;
  }

  /**
   * Get attendance history formatted for ML service consumption.
   */
  static async getAttendanceHistory(
    messId: string,
    from: string,
    to: string,
    correlationId: string
  ): Promise<{ serviceDate: string; mealType: string; attendance: number }[]> {
    const records = await AttendanceService.listAttendance(messId, from, to, correlationId);
    return records.map((r) => ({
      serviceDate: r.serviceDate,
      mealType: r.mealType,
      attendance: r.actualAttendance,
    }));
  }
}

