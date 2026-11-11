import mongoose, { Schema, Document, Model } from 'mongoose';
import { AllowedUnit } from './WasteRecord';

export interface IServingStandard {
  ingredient: string;
  amountPerPerson: number;
  unit: AllowedUnit;
}

export interface IServiceWindow {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface ISettings extends Document {
  _id: mongoose.Types.ObjectId;
  messId: mongoose.Types.ObjectId;
  serviceWindows: {
    BREAKFAST: IServiceWindow;
    LUNCH: IServiceWindow;
    SNACKS: IServiceWindow;
    DINNER: IServiceWindow;
  };
  feedbackEditWindowMinutes: number;
  servingStandards: IServingStandard[];
  defaultSafetyBufferPct: number; // 0 to 50
  createdAt: Date;
  updatedAt: Date;
}

const ServingStandardSchema = new Schema<IServingStandard>(
  {
    ingredient: { type: String, required: true, trim: true },
    amountPerPerson: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: Object.values(AllowedUnit), required: true },
  },
  { _id: false }
);

const ServiceWindowSchema = new Schema<IServiceWindow>(
  {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false }
);

const SettingsSchema = new Schema<ISettings>(
  {
    messId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    serviceWindows: {
      BREAKFAST: {
        type: ServiceWindowSchema,
        default: () => ({ startTime: '07:30', endTime: '09:30' }),
      },
      LUNCH: {
        type: ServiceWindowSchema,
        default: () => ({ startTime: '12:30', endTime: '14:30' }),
      },
      SNACKS: {
        type: ServiceWindowSchema,
        default: () => ({ startTime: '17:00', endTime: '18:30' }),
      },
      DINNER: {
        type: ServiceWindowSchema,
        default: () => ({ startTime: '19:30', endTime: '21:30' }),
      },
    },
    feedbackEditWindowMinutes: {
      type: Number,
      default: 30,
      min: 0,
      max: 1440,
    },
    servingStandards: {
      type: [ServingStandardSchema],
      default: [],
    },
    defaultSafetyBufferPct: {
      type: Number,
      default: 10,
      min: 0,
      max: 50,
    },
  },
  {
    timestamps: true,
  }
);

export const SettingsModel: Model<ISettings> =
  mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

