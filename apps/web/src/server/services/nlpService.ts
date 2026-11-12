import { connectDb } from '../lib/db';
import { FeedbackRepository } from '../repositories/FeedbackRepository';
import { FeedbackModel, SentimentLabel, SentimentStatus } from '../models/Feedback';
import { mlClient } from '../integrations/mlClient';
import { logger } from '../lib/logger';

export class NlpService {
  /**
   * Analyze feedback sentiment and persist results to Feedback document.
   * Safe fire-and-forget: does not throw errors to caller.
   */
  static async analyzeFeedbackSentiment(
    feedbackId: string,
    text: string,
    menuDishes: string[] = [],
    messId: string,
    correlationId: string
  ): Promise<void> {
    try {
      await connectDb();

      // Check existing status for idempotency
      const existing = await FeedbackModel.findById(feedbackId).lean();
      if (!existing) {
        logger.warn(`Feedback ${feedbackId} not found for sentiment analysis.`, correlationId);
        return;
      }

      if (existing.sentiment?.status === SentimentStatus.DONE) {
        logger.info(`Feedback ${feedbackId} sentiment already processed. Skipping.`, correlationId);
        return;
      }

      if (!text || text.trim().length === 0) {
        // No text to analyze, mark as NEUTRAL with 0 score
        await FeedbackRepository.updateSentiment(
          feedbackId,
          {
            label: SentimentLabel.NEUTRAL,
            score: 0,
            confidence: 1.0,
            status: SentimentStatus.DONE,
            modelVersion: 'rule_empty',
          },
          [],
          []
        );
        return;
      }

      // Call ML Service
      const result = await mlClient.analyzeSentiment(text, menuDishes, undefined, correlationId);

      const sentimentLabel = (Object.values(SentimentLabel).includes(result.sentiment.label as any)
        ? result.sentiment.label
        : SentimentLabel.UNCERTAIN) as SentimentLabel;

      await FeedbackRepository.updateSentiment(
        feedbackId,
        {
          label: sentimentLabel,
          score: result.sentiment.score,
          confidence: result.sentiment.confidence,
          status: SentimentStatus.DONE,
          modelVersion: result.modelVersion,
        },
        result.dishes.map((d) => d.dish),
        result.issues.map((i) => ({ type: i.type, dish: i.dish || undefined }))
      );

      logger.info(
        `Sentiment analysis completed for feedback ${feedbackId}: ${sentimentLabel} (${result.sentiment.score})`,
        correlationId
      );
    } catch (err: any) {
      logger.error(
        `Sentiment analysis failed for feedback ${feedbackId}: ${err.message}`,
        correlationId,
        undefined,
        err
      );

      try {
        await FeedbackModel.findByIdAndUpdate(feedbackId, {
          $set: {
            'sentiment.status': SentimentStatus.FAILED,
          },
        });
      } catch (updateErr) {
        // Suppress secondary DB update error
      }
    }
  }
}

