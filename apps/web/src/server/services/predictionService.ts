import mongoose from 'mongoose';
import { connectDb } from '../lib/db';
import { PredictionRepository } from '../repositories/PredictionRepository';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { MealType } from '../models/Menu';
import {
  IPrediction,
  PredictionSource,
  ConfidenceStatus,
  PredictionModel,
} from '../models/Prediction';
import { mlClient } from '../integrations/mlClient';
import { logger } from '../lib/logger';
import { AppError, ErrorCode } from '../lib/errors';

export class PredictionService {
  /**
   * Generate an attendance prediction for a given meal and service date.
   * Calls ML service with last 90 days history; falls back to weekday historical average on failure.
   */
  static async generatePrediction(
    messId: string,
    mealType: MealType,
    serviceDate: string,
    managerId: string,
    correlationId: string,
    capacity: number = 1000
  ): Promise<IPrediction> {
    await connectDb();

    // 1. Fetch 90 days of attendance history
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    const historyRecords = await AttendanceRepository.listRange(messId, ninetyDaysAgo, serviceDate);

    const history = historyRecords.map((r) => ({
      serviceDate: r.serviceDate,
      mealType: r.mealType,
      attendance: r.actualAttendance,
    }));

    let predictedAttendance: number;
    let lowerBound: number | undefined;
    let upperBound: number | undefined;
    let rangeAvailable = false;
    let confidenceStatus = ConfidenceStatus.INSUFFICIENT_DATA;
    let source = PredictionSource.ML;
    let modelVersion = 'unknown';

    try {
      const mlResult = await mlClient.predictAttendance(
        {
          mealType,
          serviceDate,
          history,
          capacity,
        },
        correlationId
      );

      predictedAttendance = mlResult.predictedAttendance;
      lowerBound = mlResult.lowerBound ?? undefined;
      upperBound = mlResult.upperBound ?? undefined;
      rangeAvailable = mlResult.rangeAvailable;
      confidenceStatus = mlResult.confidenceStatus as ConfidenceStatus;
      source = mlResult.source as PredictionSource;
      modelVersion = mlResult.modelVersion;
    } catch (err: any) {
      logger.warn(
        `ML prediction failed for ${messId} ${serviceDate} ${mealType}, falling back to rule-based mean: ${err.message}`,
        correlationId
      );

      // Rule-based fallback: same day-of-week and mealType average
      const targetDayOfWeek = new Date(serviceDate).getDay();
      const matchingHistory = historyRecords.filter((r) => {
        const d = new Date(r.serviceDate).getDay();
        return d === targetDayOfWeek && r.mealType === mealType;
      });

      if (matchingHistory.length > 0) {
        const sum = matchingHistory.reduce((acc, curr) => acc + curr.actualAttendance, 0);
        predictedAttendance = Math.round(sum / matchingHistory.length);
        confidenceStatus =
          matchingHistory.length >= 4 ? ConfidenceStatus.MEDIUM : ConfidenceStatus.LOW;
      } else if (historyRecords.length > 0) {
        const sum = historyRecords.reduce((acc, curr) => acc + curr.actualAttendance, 0);
        predictedAttendance = Math.round(sum / historyRecords.length);
        confidenceStatus = ConfidenceStatus.LOW;
      } else {
        predictedAttendance = Math.round(capacity * 0.7); // 70% nominal capacity
        confidenceStatus = ConfidenceStatus.INSUFFICIENT_DATA;
      }

      source = PredictionSource.FALLBACK;
      modelVersion = 'rule_based_fallback_v1';
      rangeAvailable = false;
    }

    // Bounds checking: 0 <= lower <= predicted <= upper <= capacity
    predictedAttendance = Math.max(0, Math.min(capacity, predictedAttendance));
    if (lowerBound !== undefined) {
      lowerBound = Math.max(0, Math.min(predictedAttendance, lowerBound));
    }
    if (upperBound !== undefined) {
      upperBound = Math.max(predictedAttendance, Math.min(capacity, upperBound));
    }

    const prediction = await PredictionRepository.create({
      messId: new mongoose.Types.ObjectId(messId),
      serviceDate,
      mealType,
      predictedAttendance,
      lowerBound,
      upperBound,
      rangeAvailable,
      confidenceStatus,
      source,
      modelVersion,
      generatedAt: new Date(),
    });

    await AuditLogRepository.log(
      managerId,
      'PREDICTION_GENERATED',
      'Prediction',
      correlationId,
      `Generated prediction for ${mealType} on ${serviceDate}: ${predictedAttendance} (${source})`,
      prediction._id.toString()
    );

    return prediction;
  }

  /**
   * Generate weekly prediction for all 21 slots (7 days x 3 meals).
   */
  static async generateWeeklyPrediction(
    messId: string,
    startDate: string,
    managerId: string,
    correlationId: string,
    capacity: number = 1000
  ): Promise<IPrediction[]> {
    await connectDb();

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    const historyRecords = await AttendanceRepository.listRange(messId, ninetyDaysAgo, startDate);

    const history = historyRecords.map((r) => ({
      serviceDate: r.serviceDate,
      mealType: r.mealType,
      attendance: r.actualAttendance,
    }));

    const results: IPrediction[] = [];

    try {
      const mlResult = await mlClient.predictWeekly(
        {
          startDate,
          history,
          capacity,
        },
        correlationId
      );

      for (const p of mlResult.predictions) {
        const pred = await PredictionRepository.create({
          messId: new mongoose.Types.ObjectId(messId),
          serviceDate: p.serviceDate,
          mealType: p.mealType as MealType,
          predictedAttendance: p.predictedAttendance,
          lowerBound: p.lowerBound ?? undefined,
          upperBound: p.upperBound ?? undefined,
          rangeAvailable: p.rangeAvailable,
          confidenceStatus: p.confidenceStatus as ConfidenceStatus,
          source: p.source as PredictionSource,
          modelVersion: mlResult.modelVersion,
          generatedAt: new Date(),
        });
        results.push(pred);
      }
    } catch (err: any) {
      logger.warn(
        `ML weekly prediction failed for ${messId} starting ${startDate}, generating per-slot fallbacks: ${err.message}`,
        correlationId
      );

      // Fallback for 7 days x 3 meals
      const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
      const start = new Date(startDate);

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const d = new Date(start);
        d.setDate(d.getDate() + dayOffset);
        const dateStr = d.toISOString().split('T')[0];

        for (const mt of mealTypes) {
          const pred = await this.generatePrediction(
            messId,
            mt,
            dateStr,
            managerId,
            correlationId,
            capacity
          );
          results.push(pred);
        }
      }
    }

    return results;
  }

  /**
   * Get quantity recommendations for ingredients based on predicted attendance.
   */
  static async getQuantityRecommendation(
    messId: string,
    predictedAttendance: number,
    servingStandards: Record<string, { amountPerPerson: number; unit: string }>,
    safetyBuffer: number = 0.1,
    inventory?: Record<string, number>,
    correlationId?: string
  ) {
    return mlClient.recommendQuantity(
      {
        predictedAttendance,
        servingStandards,
        safetyBuffer,
        inventory,
      },
      correlationId
    );
  }

  /**
   * Compare predicted attendance vs actual attendance to calculate accuracy.
   */
  static async getAccuracyMetrics(
    messId: string,
    from: string,
    to: string,
    correlationId: string
  ) {
    await connectDb();

    const [predictions, actuals] = await Promise.all([
      PredictionRepository.listRange(messId, from, to),
      AttendanceRepository.listRange(messId, from, to),
    ]);

    // Build actual map: `${serviceDate}_${mealType}` -> actualAttendance
    const actualMap = new Map<string, number>();
    for (const a of actuals) {
      actualMap.set(`${a.serviceDate}_${a.mealType}`, a.actualAttendance);
    }

    let mlTotalAbsDiff = 0;
    let mlTotalSquaredDiff = 0;
    let mlCount = 0;

    let allTotalAbsDiff = 0;
    let allCount = 0;

    const comparisons = [];

    for (const p of predictions) {
      const key = `${p.serviceDate}_${p.mealType}`;
      const actual = actualMap.get(key);

      if (actual !== undefined) {
        const diff = p.predictedAttendance - actual;
        const absDiff = Math.abs(diff);

        allTotalAbsDiff += absDiff;
        allCount++;

        // Only include ML predictions in ML MAE (exclude FALLBACK)
        if (p.source === PredictionSource.ML) {
          mlTotalAbsDiff += absDiff;
          mlTotalSquaredDiff += diff * diff;
          mlCount++;
        }

        comparisons.push({
          serviceDate: p.serviceDate,
          mealType: p.mealType,
          predicted: p.predictedAttendance,
          actual,
          diff,
          absDiff,
          source: p.source,
          lowerBound: p.lowerBound,
          upperBound: p.upperBound,
        });
      }
    }

    const mlMae = mlCount > 0 ? Number((mlTotalAbsDiff / mlCount).toFixed(2)) : null;
    const mlRmse = mlCount > 0 ? Number(Math.sqrt(mlTotalSquaredDiff / mlCount).toFixed(2)) : null;
    const overallMae = allCount > 0 ? Number((allTotalAbsDiff / allCount).toFixed(2)) : null;

    logger.info(
      `Prediction accuracy evaluated for messId=${messId} (${from} to ${to}): ML MAE=${mlMae}, samples=${mlCount}`,
      correlationId
    );

    return {
      mlMae,
      mlRmse,
      mlCount,
      overallMae,
      totalEvaluated: allCount,
      comparisons,
    };
  }
}

