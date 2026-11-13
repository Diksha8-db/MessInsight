// Pure TypeScript types for Feedback — NO mongoose imports.
// Safe to import in both client ('use client') and server components.

export enum SentimentLabel {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
  MIXED = 'MIXED',
  UNCERTAIN = 'UNCERTAIN',
}

export enum SentimentStatus {
  PENDING = 'PENDING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export enum ModerationStatus {
  OK = 'OK',
  FLAGGED = 'FLAGGED',
}

export interface IDishRatingClient {
  dishId: string;
  rating: number;
}

export interface IIssueMentionClient {
  type: string;
  dish?: string;
}

export interface ISentimentDataClient {
  label: SentimentLabel;
  score: number;
  confidence: number;
  status: SentimentStatus;
  modelVersion: string;
}

/** Serializable feedback shape safe for client components */
export interface IFeedbackClient {
  _id: string;
  studentId: string;
  menuId: string;
  messId: string;
  serviceDate: string;
  mealType: string;
  overallRating: number;
  dishRatings: IDishRatingClient[];
  comments?: string;
  imageUrl?: string;
  isAnonymous: boolean;
  sentiment: ISentimentDataClient;
  dishesMentioned: string[];
  issues: IIssueMentionClient[];
  moderationStatus: ModerationStatus;
  isDeleted: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

