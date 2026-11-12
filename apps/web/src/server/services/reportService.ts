import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDb } from '../lib/db';
import { ReportRepository } from '../repositories/ReportRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { IReport, ReportType } from '../models/Report';
import { AnalyticsService } from './analyticsService';
import { PredictionService } from './predictionService';
import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';

export interface ReportParams {
  type: ReportType;
  messId: string;
  from: string;
  to: string;
}

export class ReportService {
  /**
   * Neutralize spreadsheet formula injection characters (=, +, -, @, \t, \r).
   */
  static sanitizeCsvField(value: unknown): string {
    if (value === null || value === undefined) return '';
    let str = String(value);

    // Prepend single quote if starts with formula-trigger character
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }

    // Escape double quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Generate SHA-256 hash of report parameters for idempotency.
   */
  static hashParams(params: ReportParams): string {
    const sorted = JSON.stringify({
      from: params.from,
      messId: params.messId,
      to: params.to,
      type: params.type,
    });
    return crypto.createHash('sha256').update(sorted).digest('hex');
  }

  /**
   * Generate report data and persist in DB.
   */
  static async generateReport(
    params: ReportParams,
    managerId: string,
    correlationId: string
  ): Promise<IReport> {
    await connectDb();

    const paramsHash = this.hashParams(params);

    // Idempotency: return existing report if already generated for same parameters
    const existing = await ReportRepository.findByTypeAndHash(params.type, paramsHash);
    if (existing) {
      logger.info(
        `Returning existing report: type=${params.type} hash=${paramsHash}`,
        correlationId
      );
      return existing;
    }

    let reportData: Record<string, unknown> = {};

    switch (params.type) {
      case ReportType.DAILY:
      case ReportType.WEEKLY:
      case ReportType.MONTHLY: {
        const [ratings, sentiments, attendance, complaints] = await Promise.all([
          AnalyticsService.getAverageRatings(params.messId, params.from, params.to, undefined, correlationId),
          AnalyticsService.getSentimentDistribution(params.messId, params.from, params.to, correlationId),
          AnalyticsService.getAttendanceTrend(params.messId, params.from, params.to, correlationId),
          AnalyticsService.getComplaintFrequency(params.messId, params.from, params.to, correlationId),
        ]);
        reportData = { ratings, sentiments, attendance, complaints };
        break;
      }

      case ReportType.WASTE: {
        const wasteSummary = await AnalyticsService.getWasteTrend(
          params.messId,
          params.from,
          params.to,
          correlationId
        );
        reportData = { wasteSummary };
        break;
      }

      case ReportType.ACCURACY: {
        const accuracy = await PredictionService.getAccuracyMetrics(
          params.messId,
          params.from,
          params.to,
          correlationId
        );
        reportData = { accuracy };
        break;
      }

      default:
        throw AppError.badRequest(`Unsupported report type: ${params.type}`);
    }

    const report = await ReportRepository.create({
      type: params.type,
      paramsHash,
      dateRange: {
        from: params.from,
        to: params.to,
      },
      data: reportData,
      generatedBy: new mongoose.Types.ObjectId(managerId),
    });

    await AuditLogRepository.log(
      managerId,
      'REPORT_GENERATED',
      'Report',
      correlationId,
      `Generated ${params.type} report for ${params.from} to ${params.to}`,
      report._id.toString()
    );

    return report;
  }

  /**
   * Convert report data into CSV format with formula injection protection.
   */
  static async exportCsv(reportId: string): Promise<{ filename: string; csv: string }> {
    await connectDb();

    const report = await ReportRepository.findById(reportId);
    if (!report) {
      throw AppError.notFound('Report not found');
    }

    const filename = `report_${report.type.toLowerCase()}_${report.dateRange.from}_${report.dateRange.to}.csv`;
    const rows: string[][] = [];

    // Header
    rows.push(['Report Type', report.type]);
    rows.push(['Date Range', `${report.dateRange.from} to ${report.dateRange.to}`]);
    rows.push(['Generated At', report.createdAt.toISOString()]);
    rows.push([]);

    const data = report.data as any;

    if (report.type === ReportType.WASTE && Array.isArray(data.wasteSummary)) {
      rows.push([
        'Ingredient',
        'Unit',
        'Prepared Quantity',
        'Consumed Quantity',
        'Leftover Quantity',
        'Unaccounted Diff',
        'Waste Percentage (%)',
      ]);
      for (const w of data.wasteSummary) {
        rows.push([
          this.sanitizeCsvField(w.ingredient),
          this.sanitizeCsvField(w.unit),
          this.sanitizeCsvField(w.totalPrepared),
          this.sanitizeCsvField(w.totalConsumed),
          this.sanitizeCsvField(w.totalLeftover),
          this.sanitizeCsvField(w.totalUnaccounted),
          this.sanitizeCsvField(w.wastePercentage !== null ? `${w.wastePercentage}%` : 'N/A'),
        ]);
      }
    } else if (report.type === ReportType.ACCURACY && data.accuracy?.comparisons) {
      rows.push(['Overall MAE', this.sanitizeCsvField(data.accuracy.overallMae)]);
      rows.push(['ML MAE', this.sanitizeCsvField(data.accuracy.mlMae)]);
      rows.push(['ML RMSE', this.sanitizeCsvField(data.accuracy.mlRmse)]);
      rows.push([]);
      rows.push(['Date', 'Meal', 'Predicted', 'Actual', 'Diff', 'AbsDiff', 'Source']);
      for (const c of data.accuracy.comparisons) {
        rows.push([
          this.sanitizeCsvField(c.serviceDate),
          this.sanitizeCsvField(c.mealType),
          this.sanitizeCsvField(c.predicted),
          this.sanitizeCsvField(c.actual),
          this.sanitizeCsvField(c.diff),
          this.sanitizeCsvField(c.absDiff),
          this.sanitizeCsvField(c.source),
        ]);
      }
    } else {
      // General feedback & attendance summary
      if (Array.isArray(data.ratings)) {
        rows.push(['Date', 'Average Rating', 'Feedback Count']);
        for (const r of data.ratings) {
          rows.push([
            this.sanitizeCsvField(r.date),
            this.sanitizeCsvField(r.averageRating),
            this.sanitizeCsvField(r.totalFeedbacks),
          ]);
        }
        rows.push([]);
      }

      if (Array.isArray(data.sentiments)) {
        rows.push(['Sentiment Label', 'Count']);
        for (const s of data.sentiments) {
          rows.push([this.sanitizeCsvField(s.label), this.sanitizeCsvField(s.count)]);
        }
        rows.push([]);
      }
    }

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    return { filename, csv: csvContent };
  }
}

