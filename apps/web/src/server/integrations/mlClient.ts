import { z } from 'zod';
import { env } from '../config/env';
import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { circuitBreaker } from './circuitBreaker';

// Zod schemas for ML service responses
export const sentimentDetailSchema = z.object({
  label: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED', 'UNCERTAIN']),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
});

export const dishMentionSchema = z.object({
  dish: z.string(),
  start: z.number(),
  end: z.number(),
  matchScore: z.number(),
});

export const issueMentionSchema = z.object({
  type: z.string(),
  dish: z.string().nullable().optional(),
});

export const sentimentAnalysisResponseSchema = z.object({
  sentiment: sentimentDetailSchema,
  dishes: z.array(dishMentionSchema),
  issues: z.array(issueMentionSchema),
  language: z.string(),
  modelVersion: z.string(),
  analysedAt: z.string(),
});

export const attendancePredictionResponseSchema = z.object({
  predictedAttendance: z.number().int().min(0),
  lowerBound: z.number().int().nullable().optional(),
  upperBound: z.number().int().nullable().optional(),
  rangeAvailable: z.boolean(),
  confidenceStatus: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA']),
  source: z.enum(['ML', 'BASELINE', 'FALLBACK']),
  modelVersion: z.string(),
  generatedAt: z.string(),
});

export const weeklyPredictionEntrySchema = z.object({
  serviceDate: z.string(),
  mealType: z.string(),
  predictedAttendance: z.number().int(),
  lowerBound: z.number().int().nullable().optional(),
  upperBound: z.number().int().nullable().optional(),
  rangeAvailable: z.boolean(),
  confidenceStatus: z.enum(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA']),
  source: z.enum(['ML', 'BASELINE', 'FALLBACK']),
});

export const weeklyPredictionResponseSchema = z.object({
  predictions: z.array(weeklyPredictionEntrySchema),
  modelVersion: z.string(),
  generatedAt: z.string(),
});

export const ingredientRequirementSchema = z.object({
  ingredient: z.string(),
  requiredQuantity: z.number(),
  purchaseQuantity: z.number().nullable().optional(),
  surplusQuantity: z.number().nullable().optional(),
  unit: z.string(),
  status: z.string(),
});

export const quantityRecommendResponseSchema = z.object({
  predictedAttendance: z.number(),
  safetyBuffer: z.number(),
  requirements: z.array(ingredientRequirementSchema),
});

export const ingredientWasteSummarySchema = z.object({
  ingredient: z.string(),
  wastePercentage: z.number().nullable().optional(),
  consumptionRate: z.number().nullable().optional(),
  totalPrepared: z.number(),
  totalConsumed: z.number(),
  totalLeftover: z.number(),
  unit: z.string(),
});

export const wasteAnalysisResponseSchema = z.object({
  summary: z.array(ingredientWasteSummarySchema),
  validationErrors: z.array(z.string()),
});

export type SentimentAnalysisResult = z.infer<typeof sentimentAnalysisResponseSchema>;
export type AttendancePredictionResult = z.infer<typeof attendancePredictionResponseSchema>;
export type WeeklyPredictionResult = z.infer<typeof weeklyPredictionResponseSchema>;
export type QuantityRecommendResult = z.infer<typeof quantityRecommendResponseSchema>;
export type WasteAnalysisResult = z.infer<typeof wasteAnalysisResponseSchema>;

export class MlClient {
  private baseUrl: string;
  private secret: string;

  constructor() {
    this.baseUrl = env.ML_SERVICE_URL.replace(/\/+$/, '');
    this.secret = env.ML_SERVICE_SECRET;
  }

  private async postWithRetry<T>(
    endpoint: string,
    body: unknown,
    schema: z.ZodType<T>,
    timeoutMs: number = 10000,
    correlationId?: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    return circuitBreaker.execute(async () => {
      let lastError: Error | null = null;
      const maxRetries = 2;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          const baseDelay = 100 * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 100 - 50;
          const delay = Math.max(20, baseDelay + jitter);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-ML-Secret': this.secret,
              'X-Correlation-ID': correlationId || crypto.randomUUID(),
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            const status = res.status;
            let errorText = '';
            try {
              errorText = await res.text();
            } catch {
              errorText = res.statusText;
            }

            if (status >= 400 && status < 500) {
              // Client error - do not retry
              throw new AppError(
                `ML Service error (${status}): ${errorText}`,
                status === 401 ? 401 : 422,
                ErrorCode.ML_SERVICE_UNAVAILABLE
              );
            }

            // 5xx Server error - eligible for retry
            throw new Error(`ML Service 5xx error (${status}): ${errorText}`);
          }

          const json = await res.json();
          const parsed = schema.safeParse(json);
          if (!parsed.success) {
            logger.error(
              `ML Service response validation failed for ${endpoint}`,
              correlationId,
              { issues: parsed.error.issues }
            );
            throw AppError.internal('ML service returned invalid response format.');
          }

          return parsed.data;
        } catch (err: any) {
          clearTimeout(timeoutId);
          lastError = err;

          // If it's an AppError (4xx client error or schema validation failure), do not retry
          if (err instanceof AppError) {
            throw err;
          }

          logger.warn(
            `ML Service call to ${endpoint} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${err.message}`,
            correlationId
          );
        }
      }

      throw new AppError(
        `ML Service request to ${endpoint} failed after retries: ${lastError?.message}`,
        503,
        ErrorCode.ML_SERVICE_UNAVAILABLE
      );
    }, correlationId);
  }

  async analyzeSentiment(
    text: string,
    menuDishes: string[] = [],
    language?: string,
    correlationId?: string
  ): Promise<SentimentAnalysisResult> {
    return this.postWithRetry(
      '/sentiment/analyze',
      { text, menuDishes, language },
      sentimentAnalysisResponseSchema,
      10000,
      correlationId
    );
  }

  async predictAttendance(
    params: {
      mealType: string;
      serviceDate: string;
      history: Array<{ serviceDate: string; mealType: string; attendance: number }>;
      capacity?: number;
    },
    correlationId?: string
  ): Promise<AttendancePredictionResult> {
    return this.postWithRetry(
      '/prediction/attendance',
      params,
      attendancePredictionResponseSchema,
      10000,
      correlationId
    );
  }

  async predictWeekly(
    params: {
      startDate: string;
      history: Array<{ serviceDate: string; mealType: string; attendance: number }>;
      capacity?: number;
    },
    correlationId?: string
  ): Promise<WeeklyPredictionResult> {
    return this.postWithRetry(
      '/prediction/weekly',
      params,
      weeklyPredictionResponseSchema,
      30000,
      correlationId
    );
  }

  async recommendQuantity(
    params: {
      predictedAttendance: number;
      servingStandards: Record<string, { amountPerPerson: number; unit: string }>;
      safetyBuffer?: number;
      inventory?: Record<string, number>;
    },
    correlationId?: string
  ): Promise<QuantityRecommendResult> {
    return this.postWithRetry(
      '/quantity/recommend',
      params,
      quantityRecommendResponseSchema,
      10000,
      correlationId
    );
  }

  async analyzeWaste(
    records: Array<{
      ingredient: string;
      preparedQuantity: number;
      consumedQuantity: number;
      leftoverQuantity: number;
      unit: string;
    }>,
    correlationId?: string
  ): Promise<WasteAnalysisResult> {
    return this.postWithRetry(
      '/waste/analyze',
      { records },
      wasteAnalysisResponseSchema,
      10000,
      correlationId
    );
  }
}

export const mlClient = new MlClient();
