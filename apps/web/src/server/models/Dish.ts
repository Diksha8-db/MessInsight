import mongoose, { Schema, Document, Model } from 'mongoose';

export enum DishCategory {
  MAIN_COURSE = 'MAIN_COURSE',
  SIDE_DISH = 'SIDE_DISH',
  BEVERAGE = 'BEVERAGE',
  DESSERT = 'DESSERT',
  BREAD = 'BREAD',
  SNACK = 'SNACK',
  OTHER = 'OTHER',
}

export interface IDish extends Document {
  _id: mongoose.Types.ObjectId;
  messId: mongoose.Types.ObjectId;
  name: string;
  category: DishCategory;
  aliases: string[];
  isAvailable: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DishSchema = new Schema<IDish>(
  {
    messId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Dish name is required'],
      trim: true,
      maxlength: [100, 'Dish name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      enum: Object.values(DishCategory),
      default: DishCategory.MAIN_COURSE,
    },
    aliases: {
      type: [String],
      default: [],
    },
    isAvailable: {
      type: Boolean,
      default: true,
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

DishSchema.index({ messId: 1, name: 1, isDeleted: 1 });

export const DishModel: Model<IDish> =
  mongoose.models.Dish || mongoose.model<IDish>('Dish', DishSchema);

