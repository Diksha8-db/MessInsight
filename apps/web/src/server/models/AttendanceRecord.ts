import mongoose, { Schema, Document, Model } from 'mongoose';
import { MealType } from './Menu';

export interface IAttendanceRecord extends Document {
  _id: mongoose.Types.ObjectId;
  messId: mongoose.Types.ObjectId;
  serviceDate: string; // YYYY-MM-DD
  mealType: MealType;
  actualAttendance: number;
  recordedBy: mongoose.Types.ObjectId;
  isManualEdit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    messId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    serviceDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Service date must be in YYYY-MM-DD format'],
      index: true,
    },
    mealType: {
      type: String,
      enum: Object.values(MealType),
      required: true,
      index: true,
    },
    actualAttendance: {
      type: Number,
      required: true,
      min: [0, 'Attendance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Attendance count must be an integer',
      },
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    isManualEdit: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique (messId, serviceDate, mealType)
AttendanceRecordSchema.index(
  { messId: 1, serviceDate: 1, mealType: 1 },
  { unique: true }
);

export const AttendanceRecordModel: Model<IAttendanceRecord> =
  mongoose.models.AttendanceRecord ||
  mongoose.model<IAttendanceRecord>('AttendanceRecord', AttendanceRecordSchema);

