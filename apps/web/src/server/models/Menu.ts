import mongoose, { Schema, Document, Model } from 'mongoose';

export enum MealType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  SNACKS = 'SNACKS',
  DINNER = 'DINNER',
}

export enum MenuStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export interface IMenuDishItem {
  dishId: mongoose.Types.ObjectId;
  name: string;
  category: string;
  isAvailable: boolean;
}

export interface IMenu extends Document {
  _id: mongoose.Types.ObjectId;
  messId: mongoose.Types.ObjectId;
  serviceDate: string; // YYYY-MM-DD
  mealType: MealType;
  dishes: IMenuDishItem[];
  status: MenuStatus;
  version: number;
  publishedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MenuDishItemSchema = new Schema<IMenuDishItem>(
  {
    dishId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'MAIN_COURSE',
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const MenuSchema = new Schema<IMenu>(
  {
    messId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    serviceDate: {
      type: String,
      required: [true, 'Service date is required (YYYY-MM-DD)'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Service date must be in YYYY-MM-DD format'],
      index: true,
    },
    mealType: {
      type: String,
      enum: Object.values(MealType),
      required: true,
      index: true,
    },
    dishes: {
      type: [MenuDishItemSchema],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(MenuStatus),
      default: MenuStatus.DRAFT,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    publishedAt: {
      type: Date,
      default: null,
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

// Enforce unique (messId, serviceDate, mealType) among non-deleted menus
MenuSchema.index(
  { messId: 1, serviceDate: 1, mealType: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false },
  }
);

export const MenuModel: Model<IMenu> =
  mongoose.models.Menu || mongoose.model<IMenu>('Menu', MenuSchema);

