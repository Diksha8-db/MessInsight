import mongoose, { Schema, Document, Model } from 'mongoose';
import { MealType } from './Menu';

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

export interface IDishRating {
  dishId: mongoose.Types.ObjectId;
  rating: number; // 1-5
}

export interface IIssueMention {
  type: string;
  dish?: string;
}

export interface ISentimentData {
  label: SentimentLabel;
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  status: SentimentStatus;
  modelVersion: string;
}

export interface IFeedback extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  menuId: mongoose.Types.ObjectId;
  messId: mongoose.Types.ObjectId;
  serviceDate: string; // YYYY-MM-DD
  mealType: MealType;
  overallRating: number; // 1-5
  dishRatings: IDishRating[];
  comments?: string;
  imageUrl?: string;
  isAnonymous: boolean;
  idempotencyKey?: string;
  sentiment: ISentimentData;
  dishesMentioned: string[];
  issues: IIssueMention[];
  moderationStatus: ModerationStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DishRatingSchema = new Schema<IDishRating>(
  {
    dishId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: [1, 'Dish rating must be at least 1'],
      max: [5, 'Dish rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Dish rating must be an integer',
      },
    },
  },
  { _id: false }
);

const SentimentSchema = new Schema<ISentimentData>(
  {
    label: {
      type: String,
      enum: Object.values(SentimentLabel),
      default: SentimentLabel.UNCERTAIN,
    },
    score: {
      type: Number,
      default: 0,
      min: -1,
      max: 1,
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    status: {
      type: String,
      enum: Object.values(SentimentStatus),
      default: SentimentStatus.PENDING,
      index: true,
    },
    modelVersion: {
      type: String,
      default: 'stub-v0',
    },
  },
  { _id: false }
);

const FeedbackSchema = new Schema<IFeedback>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    menuId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    messId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    serviceDate: {
      type: String,
      required: true,
      index: true,
    },
    mealType: {
      type: String,
      enum: Object.values(MealType),
      required: true,
      index: true,
    },
    overallRating: {
      type: Number,
      required: [true, 'Overall rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Overall rating must be an integer between 1 and 5',
      },
    },
    dishRatings: {
      type: [DishRatingSchema],
      default: [],
    },
    comments: {
      type: String,
      maxlength: [1000, 'Comments cannot exceed 1000 characters'],
      trim: true,
      default: null,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
    },
    sentiment: {
      type: SentimentSchema,
      default: () => ({}),
    },
    dishesMentioned: {
      type: [String],
      default: [],
    },
    issues: [
      {
        type: { type: String, required: true },
        dish: { type: String },
      },
    ],
    moderationStatus: {
      type: String,
      enum: Object.values(ModerationStatus),
      default: ModerationStatus.OK,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique (studentId, menuId) among non-deleted feedback
FeedbackSchema.index(
  { studentId: 1, menuId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  }
);

FeedbackSchema.index({ messId: 1, serviceDate: 1, mealType: 1 });

export const FeedbackModel: Model<IFeedback> =
  mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', FeedbackSchema);

