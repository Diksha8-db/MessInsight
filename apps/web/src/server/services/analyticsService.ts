import mongoose, { PipelineStage } from 'mongoose';
import { connectDb } from '../lib/db';
import { FeedbackModel, SentimentStatus } from '../models/Feedback';
import { ComplaintModel } from '../models/Complaint';
import { AttendanceRecordModel } from '../models/AttendanceRecord';
import { WasteRecordModel } from '../models/WasteRecord';
import { MealType } from '../models/Menu';
import { logger } from '../lib/logger';

export class AnalyticsService {
  /**
   * Average overall ratings grouped by day and optionally filtered by mealType.
   */
  static async getAverageRatings(
    messId: string,
    from: string,
    to: string,
    mealType?: MealType,
    correlationId?: string
  ) {
    await connectDb();

    const match: Record<string, unknown> = {
      messId: new mongoose.Types.ObjectId(messId),
      serviceDate: { $gte: from, $lte: to },
      isDeleted: false,
    };
    if (mealType) {
      match.mealType = mealType;
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $group: {
          _id: '$serviceDate',
          averageRating: { $avg: '$overallRating' },
          totalFeedbacks: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          averageRating: { $round: ['$averageRating', 2] },
          totalFeedbacks: 1,
        },
      },
    ];

    const results = await FeedbackModel.aggregate(pipeline).exec();
    logger.info(`Ratings analytics fetched for messId=${messId} (${from} to ${to})`, correlationId);
    return results;
  }

  /**
   * Average dish ratings from dishRatings sub-array across feedback.
   */
  static async getDishRatings(
    messId: string,
    from: string,
    to: string,
    correlationId?: string
  ) {
    await connectDb();

    const pipeline: PipelineStage[] = [
      {
        $match: {
          messId: new mongoose.Types.ObjectId(messId),
          serviceDate: { $gte: from, $lte: to },
          isDeleted: false,
          'dishRatings.0': { $exists: true },
        },
      },
      { $unwind: '$dishRatings' },
      {
        $group: {
          _id: '$dishRatings.dishId',
          averageRating: { $avg: '$dishRatings.rating' },
          ratingCount: { $sum: 1 },
        },
      },
      { $sort: { averageRating: -1 as const } },
      {
        $lookup: {
          from: 'dishes',
          localField: '_id',
          foreignField: '_id',
          as: 'dishInfo',
        },
      },
      {
        $project: {
          _id: 0,
          dishId: '$_id',
          dishName: { $arrayElemAt: ['$dishInfo.name', 0] },
          category: { $arrayElemAt: ['$dishInfo.category', 0] },
          averageRating: { $round: ['$averageRating', 2] },
          ratingCount: 1,
        },
      },
    ];

    const results = await FeedbackModel.aggregate(pipeline).exec();
    return results;
  }

  /**
   * Sentiment label distribution counts (POSITIVE, NEGATIVE, NEUTRAL, MIXED, UNCERTAIN, PENDING).
   */
  static async getSentimentDistribution(
    messId: string,
    from: string,
    to: string,
    correlationId?: string
  ) {
    await connectDb();

    const pipeline: PipelineStage[] = [
      {
        $match: {
          messId: new mongoose.Types.ObjectId(messId),
          serviceDate: { $gte: from, $lte: to },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sentiment.status', SentimentStatus.DONE] },
              '$sentiment.label',
              'PENDING',
            ],
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          label: '$_id',
          count: 1,
        },
      },
    ];

    const results = await FeedbackModel.aggregate(pipeline).exec();
    return results;
  }

  /**
   * Weekly or daily sentiment trend score over time (-1.0 to +1.0).
   */
  static async getSentimentTrend(
    messId: string,
    from: string,
    to: string,
    correlationId?: string
  ) {
    await connectDb();

    const pipeline: PipelineStage[] = [
      {
        $match: {
          messId: new mongoose.Types.ObjectId(messId),
          serviceDate: { $gte: from, $lte: to },
          isDeleted: false,
          'sentiment.status': SentimentStatus.DONE,
        },
      },
      {
        $group: {
          _id: '$serviceDate',
          averageScore: { $avg: '$sentiment.score' },
          sampleCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 as const } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          averageScore: { $round: ['$averageScore', 3] },
          sampleCount: 1,
        },
      },
    ];

    return FeedbackModel.aggregate(pipeline).exec();
  }

  /**
   * Top 10 most frequent issues mentioned in student feedback.
   */
  static async getTopIssues(
    messId: string,
    from: string,
    to: string,
    correlationId?: string
  ) {
    await connectDb();

    const pipeline: PipelineStage[] = [
      {
        $match: {
          messId: new mongoose.Types.ObjectId(messId),
          serviceDate: { $gte: from, $lte: to },
          isDeleted: false,
          'issues.0': { $exists: true },
        },
      },
      { $unwind: '$issues' },
      {
        $group: {
          _id: '$issues.type',
          count: { $sum: 1 },
          dishes: { $addToSet: '$issues.dish' },
        },
      },
      { $sort: { count: -1 as const } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          issue: '$_id',
          count: 1,
          dishes: {
            $filter: {
              input: '$dishes',
              as: 'd',
              cond: { $and: [{ $ne: ['$$d', null] }, { $ne: ['$$d', ''] }] },
            },
          },
        },
      },
    ];

    return FeedbackModel.aggregate(pipeline).exec();
  }

  /**
   * Complaints grouped by category and status.
   */
  static async getComplaintFrequency(
    messId: string,
    from: string,
    to: string,
    correlationId?: string
  ) {
    await connectDb();

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const pipeline: PipelineStage[] = [
      {
        $match: {
          messId: new mongoose.Types.ObjectId(messId),
          createdAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: {
            category: '$category',
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          category: '$_id.category',
          status: '$_id.status',
          count: 1,
        },
      },
      { $sort: { count: -1 as const } },
    ];

    return ComplaintModel.aggregate(pipeline).exec();
  }

  /**
   * Actual attendance trends grouped by date and meal.
   */
  static async getAttendanceTrend(
    messId: string,
    from: string,
    to: string,
    correlationId?: string
  ) {
    await connectDb();

    const records = await AttendanceRecordModel.find({
      messId: new mongoose.Types.ObjectId(messId),
      serviceDate: { $gte: from, $lte: to },
    })
      .sort({ serviceDate: 1, mealType: 1 })
      .lean()
      .exec();

    return records.map((r) => ({
      serviceDate: r.serviceDate,
      mealType: r.mealType,
      actualAttendance: r.actualAttendance,
    }));
  }

  /**
   * Waste percentage per ingredient.
   */
  static async getWasteTrend(
    messId: string,
    from: string,
    to: string,
    correlationId?: string
  ) {
    await connectDb();

    const pipeline: PipelineStage[] = [
      {
        $match: {
          messId: new mongoose.Types.ObjectId(messId),
          serviceDate: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            ingredient: '$ingredient',
            unit: '$unit',
          },
          totalPrepared: { $sum: '$preparedQuantity' },
          totalConsumed: { $sum: '$consumedQuantity' },
          totalLeftover: { $sum: '$leftoverQuantity' },
          totalUnaccounted: { $sum: '$unaccountedDiff' },
        },
      },
      {
        $project: {
          _id: 0,
          ingredient: '$_id.ingredient',
          unit: '$_id.unit',
          totalPrepared: 1,
          totalConsumed: 1,
          totalLeftover: 1,
          totalUnaccounted: 1,
          wastePercentage: {
            $cond: [
              { $gt: ['$totalPrepared', 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ['$totalLeftover', '$totalPrepared'] },
                      100,
                    ],
                  },
                  2,
                ],
              },
              null,
            ],
          },
        },
      },
      { $sort: { totalPrepared: -1 as const } },
    ];

    return WasteRecordModel.aggregate(pipeline).exec();
  }
}
