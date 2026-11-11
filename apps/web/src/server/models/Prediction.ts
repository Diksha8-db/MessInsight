import mongoose, { Schema, Document, Model } from 'mongoose';
import { MealType } from './Menu';

export enum PredictionSource {
  ML = 'ML',
  BASELINE = 'BASELINE',
  FALLBACK = 'FALLBACK',
}

export enum ConfidenceStatus {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
}

export interface IPrediction extends Document {
  _id: mongoose.Types.ObjectId;
  messId: mongoose.Types.ObjectId;
  serviceDate: string; // YYYY-MM-DD
  mealType: MealType;
  predictedAttendance: number;
  lowerBound?: number;
  upperBound?: number;
  rangeAvailable: boolean;
  confidenceStatus: ConfidenceStatus;
  source: PredictionSource;
  modelVersion: string;
  generatedAt: Date;
}

const PredictionSchema = new Schema<IPrediction>(
  {
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
    predictedAttendance: {
      type: Number,
      required: true,
      min: [0, 'Predicted attendance cannot be negative'],
    },
    lowerBound: {
      type: Number,
      default: null,
    },
    upperBound: {
      type: Number,
      default: null,
    },
    rangeAvailable: {
      type: Boolean,
      default: false,
    },
    confidenceStatus: {
      type: String,
      enum: Object.values(ConfidenceStatus),
      default: ConfidenceStatus.INSUFFICIENT_DATA,
    },
    source: {
      type: String,
      enum: Object.values(PredictionSource),
      default: PredictionSource.ML,
    },
    modelVersion: {
      type: String,
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

PredictionSchema.index({ messId: 1, serviceDate: 1, mealType: 1, generatedAt: -1 });

export const PredictionModel: Model<IPrediction> =
  mongoose.models.Prediction || mongoose.model<IPrediction>('Prediction', PredictionSchema);

