import mongoose, { Schema, Document, Model } from 'mongoose';
import { MealType } from './Menu';

export enum AllowedUnit {
  KG = 'kg',
  G = 'g',
  L = 'l',
  ML = 'ml',
  COUNT = 'count',
}

export interface IWasteRecord extends Document {
  _id: mongoose.Types.ObjectId;
  messId: mongoose.Types.ObjectId;
  serviceDate: string; // YYYY-MM-DD
  mealType: MealType;
  ingredient: string;
  preparedQuantity: number;
  consumedQuantity: number;
  leftoverQuantity: number;
  unaccountedDiff: number;
  unit: AllowedUnit;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WasteRecordSchema = new Schema<IWasteRecord>(
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
    ingredient: {
      type: String,
      required: [true, 'Ingredient name is required'],
      trim: true,
    },
    preparedQuantity: {
      type: Number,
      required: true,
      min: [0, 'Prepared quantity cannot be negative'],
    },
    consumedQuantity: {
      type: Number,
      required: true,
      min: [0, 'Consumed quantity cannot be negative'],
      validate: {
        validator: function (this: mongoose.Document, val: number) {
          const prep = (this as unknown as IWasteRecord).preparedQuantity;
          return prep === undefined || val <= prep;
        },
        message: 'Consumed quantity cannot exceed prepared quantity',
      },
    },
    leftoverQuantity: {
      type: Number,
      required: true,
      min: [0, 'Leftover quantity cannot be negative'],
      validate: {
        validator: function (this: mongoose.Document, val: number) {
          const prep = (this as unknown as IWasteRecord).preparedQuantity;
          return prep === undefined || val <= prep;
        },
        message: 'Leftover quantity cannot exceed prepared quantity',
      },
    },
    unaccountedDiff: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      enum: Object.values(AllowedUnit),
      required: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

WasteRecordSchema.pre('save', function (this: mongoose.Document) {
  const doc = this as unknown as IWasteRecord;
  const prep = doc.preparedQuantity || 0;
  const cons = doc.consumedQuantity || 0;
  const left = doc.leftoverQuantity || 0;
  doc.unaccountedDiff = Number((prep - (cons + left)).toFixed(4));
});

// Enforce unique (messId, serviceDate, mealType, ingredient)
WasteRecordSchema.index(
  { messId: 1, serviceDate: 1, mealType: 1, ingredient: 1 },
  { unique: true }
);

export const WasteRecordModel: Model<IWasteRecord> =
  mongoose.models.WasteRecord || mongoose.model<IWasteRecord>('WasteRecord', WasteRecordSchema);

