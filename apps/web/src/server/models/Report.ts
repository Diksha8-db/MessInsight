import mongoose, { Schema, Document, Model } from 'mongoose';

export enum ReportType {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  WASTE = 'WASTE',
  ACCURACY = 'ACCURACY',
}

export interface IReport extends Document {
  _id: mongoose.Types.ObjectId;
  type: ReportType;
  paramsHash: string;
  dateRange: {
    from: string;
    to: string;
  };
  data: Record<string, unknown>;
  generatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    type: {
      type: String,
      enum: Object.values(ReportType),
      required: true,
      index: true,
    },
    paramsHash: {
      type: String,
      required: true,
      index: true,
    },
    dateRange: {
      from: { type: String, required: true },
      to: { type: String, required: true },
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Enforce unique (type, paramsHash)
ReportSchema.index({ type: 1, paramsHash: 1 }, { unique: true });

export const ReportModel: Model<IReport> =
  mongoose.models.Report || mongoose.model<IReport>('Report', ReportSchema);

