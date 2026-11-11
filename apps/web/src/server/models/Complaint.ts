import mongoose, { Schema, Document, Model } from 'mongoose';

export enum ComplaintCategory {
  FOOD_HYGIENE = 'FOOD_HYGIENE',
  WATER_QUALITY = 'WATER_QUALITY',
  CONTAMINATION = 'CONTAMINATION',
  CLEANLINESS = 'CLEANLINESS',
  FOOD_STORAGE = 'FOOD_STORAGE',
  OTHER = 'OTHER',
}

export enum ComplaintPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ComplaintStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export interface IComplaintHistory {
  status: ComplaintStatus;
  changedBy: mongoose.Types.ObjectId;
  note?: string;
  timestamp: Date;
}

export interface IComplaint extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  messId: mongoose.Types.ObjectId;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  title: string;
  description: string;
  imageUrl?: string;
  feedbackId?: mongoose.Types.ObjectId;
  managerResponse?: string;
  resolvedAt?: Date;
  history: IComplaintHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const ComplaintHistorySchema = new Schema<IComplaintHistory>(
  {
    status: {
      type: String,
      enum: Object.values(ComplaintStatus),
      required: true,
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    note: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ComplaintSchema = new Schema<IComplaint>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    messId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(ComplaintCategory),
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(ComplaintPriority),
      default: ComplaintPriority.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(ComplaintStatus),
      default: ComplaintStatus.OPEN,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Complaint title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Complaint description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    imageUrl: {
      type: String,
      default: null,
    },
    feedbackId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    managerResponse: {
      type: String,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    history: {
      type: [ComplaintHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

ComplaintSchema.index({ messId: 1, status: 1 });

export const ComplaintModel: Model<IComplaint> =
  mongoose.models.Complaint || mongoose.model<IComplaint>('Complaint', ComplaintSchema);

