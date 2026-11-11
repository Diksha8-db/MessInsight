import mongoose, { Schema, Document, Model } from 'mongoose';

export enum UserRole {
  STUDENT = 'STUDENT',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN',
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  instituteEmail: string;
  passwordHash: string;
  role: UserRole;
  isVerified: boolean;
  isBlocked: boolean;
  assignedMessId?: mongoose.Types.ObjectId;
  tokenVersion: number;
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  otpHash?: string;
  otpExpiresAt?: Date;
  otpAttempts: number;
  otpLastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    instituteEmail: {
      type: String,
      required: [true, 'Institute email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.STUDENT,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    assignedMessId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockoutUntil: {
      type: Date,
      default: null,
    },
    otpHash: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpLastSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

