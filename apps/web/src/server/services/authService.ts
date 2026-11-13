import mongoose from 'mongoose';
import { connectDb } from '../lib/db';
import { UserRepository } from '../repositories/UserRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { UserRole, IUser } from '../models/User';
import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import {
  hashPassword,
  comparePassword,
  generateOtp,
  hashOtp,
  verifyOtpHash,
  signSessionToken,
  generateRandomToken,
  hashToken,
} from '../lib/auth';
import { emailService } from './emailService';
import {
  RegisterInput,
  LoginInput,
  VerifyEmailInput,
  ResendOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from '../validators/authValidators';

export interface AuthSessionResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    messId?: string;
  };
  token: string;
}

export class AuthService {
  static sanitizeUser(user: IUser) {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.instituteEmail,
      role: user.role,
      isVerified: user.isVerified,
      isBlocked: user.isBlocked,
      messId: user.assignedMessId ? user.assignedMessId.toString() : undefined,
      createdAt: user.createdAt,
    };
  }

  static async register(input: RegisterInput, correlationId: string) {
    await connectDb();
    const email = input.instituteEmail.toLowerCase().trim();
    logger.info('[AuthService] Initiating registration', correlationId, { email });
    const existing = await UserRepository.findByEmail(email);

    if (existing) {
      if (existing.isVerified) {
        throw AppError.conflict('An account with this email address already exists.', ErrorCode.CONFLICT);
      }
      // If unverified, clean up previous unverified record so user can register fresh
      await UserRepository.anonymize(existing._id);
    }

    const passwordHash = await hashPassword(input.password);
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Role is strictly forced to STUDENT regardless of any client payload
    const user = await UserRepository.create({
      name: input.name,
      instituteEmail: email,
      passwordHash,
      role: UserRole.STUDENT,
      isVerified: false,
      isBlocked: false,
      tokenVersion: 0,
      otpHash,
      otpExpiresAt,
      otpAttempts: 0,
      otpLastSentAt: new Date(),
    });

    const emailResult = await emailService.sendOtpEmail(email, otp);

    const isDev = process.env.NODE_ENV !== 'production';
    const successMsg = isDev
      ? `Registration successful! (Dev Code: ${otp})`
      : 'Registration successful. Please enter the verification OTP sent to your institute email.';

    return {
      user: this.sanitizeUser(user),
      emailSent: emailResult.success,
      message: emailResult.success
        ? successMsg
        : 'Registration completed, but verification email delivery failed. You may use the resend option.',
    };
  }

  static async verifyEmail(input: VerifyEmailInput, correlationId: string) {
    await connectDb();
    const email = input.instituteEmail.toLowerCase().trim();
    logger.info('[AuthService] Verifying email OTP', correlationId, { email });
    const user = await UserRepository.findByEmail(email);

    if (!user) {
      throw AppError.notFound('Account not found.', ErrorCode.NOT_FOUND);
    }

    if (user.isVerified) {
      throw AppError.badRequest('Email is already verified. Please log in.', ErrorCode.BAD_REQUEST);
    }

    if (!user.otpHash || !user.otpExpiresAt) {
      throw AppError.badRequest('No active verification OTP found. Please request a new one.', ErrorCode.OTP_INVALID);
    }

    if (new Date() > user.otpExpiresAt) {
      throw new AppError('Verification OTP has expired. Please request a new one.', 410, ErrorCode.OTP_EXPIRED);
    }

    if (user.otpAttempts >= 5) {
      // Invalidate OTP on 5 failed attempts
      await UserRepository.update(user._id, { otpHash: null, otpExpiresAt: null });
      throw AppError.badRequest('Maximum verification attempts exceeded. Please request a new OTP.', ErrorCode.OTP_MAX_ATTEMPTS);
    }

    const isValid = verifyOtpHash(input.otp, user.otpHash);
    if (!isValid) {
      const attempts = user.otpAttempts + 1;
      await UserRepository.update(user._id, {
        otpAttempts: attempts,
        ...(attempts >= 5 ? { otpHash: null, otpExpiresAt: null } : {}),
      });

      throw AppError.badRequest(
        attempts >= 5
          ? 'Invalid OTP. Maximum attempts exceeded. Please request a new one.'
          : `Invalid OTP. ${5 - attempts} attempts remaining.`,
        ErrorCode.OTP_INVALID
      );
    }

    // OTP Valid: verify account and invalidate OTP
    const verifiedUser = await UserRepository.update(user._id, {
      isVerified: true,
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
    });

    return {
      message: 'Email verified successfully. You may now log in.',
      user: verifiedUser ? this.sanitizeUser(verifiedUser) : undefined,
    };
  }

  static async resendOtp(input: ResendOtpInput) {
    await connectDb();
    const email = input.instituteEmail.toLowerCase().trim();
    const user = await UserRepository.findByEmail(email);

    if (!user) {
      // Return uniform message to avoid user enumeration
      return { message: 'If an unverified account exists, a new OTP has been sent.' };
    }

    if (user.isVerified) {
      return { message: 'Account is already verified. Please log in.' };
    }

    // Check 60-second cooldown
    if (user.otpLastSentAt) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(user.otpLastSentAt).getTime()) / 1000);
      if (elapsedSeconds < 60) {
        const retryAfter = 60 - elapsedSeconds;
        throw AppError.rateLimited(`Please wait ${retryAfter} seconds before requesting another OTP.`, retryAfter);
      }
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await UserRepository.update(user._id, {
      otpHash,
      otpExpiresAt,
      otpAttempts: 0,
      otpLastSentAt: new Date(),
    });

    const emailResult = await emailService.sendOtpEmail(email, otp);

    const isDev = process.env.NODE_ENV !== 'production';
    const resendMsg = isDev
      ? `A fresh verification OTP has been sent! (Dev Code: ${otp})`
      : 'A fresh verification OTP has been sent to your email.';

    return {
      message: emailResult.success
        ? resendMsg
        : 'Could not deliver email at this time. Please try again shortly.',
      emailSent: emailResult.success,
    };
  }

  static async login(input: LoginInput, correlationId: string): Promise<AuthSessionResult> {
    await connectDb();
    const email = input.instituteEmail.toLowerCase().trim();
    const user = await UserRepository.findByEmail(email);

    // Generic error for unknown user
    if (!user) {
      throw AppError.unauthorized('Invalid email or password.', ErrorCode.INVALID_CREDENTIALS);
    }

    // Check lockout
    if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
      const remainingSecs = Math.ceil((new Date(user.lockoutUntil).getTime() - Date.now()) / 1000);
      throw AppError.rateLimited(
        `Account temporarily locked due to multiple failed login attempts. Try again in ${Math.ceil(remainingSecs / 60)} minutes.`,
        remainingSecs
      );
    }

    const isMatch = await comparePassword(input.password, user.passwordHash);
    if (!isMatch) {
      const newAttempts = user.failedLoginAttempts + 1;
      let lockoutDate: Date | null = null;

      if (newAttempts >= 5) {
        lockoutDate = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lockout
        await AuditLogRepository.log(
          user._id,
          'LOGIN_LOCKOUT',
          'Users',
          correlationId,
          `Account locked after 5 failed login attempts`
        );
      }

      await UserRepository.update(user._id, {
        failedLoginAttempts: newAttempts,
        lockoutUntil: lockoutDate,
      });

      if (newAttempts >= 5) {
        throw AppError.rateLimited(
          'Too many failed login attempts. Account temporarily locked for 15 minutes.',
          15 * 60
        );
      }

      throw AppError.unauthorized('Invalid email or password.', ErrorCode.INVALID_CREDENTIALS);
    }

    // Check blocked status
    if (user.isBlocked) {
      await AuditLogRepository.log(user._id, 'BLOCKED_LOGIN_ATTEMPT', 'Users', correlationId, 'Blocked user attempted login');
      throw AppError.forbidden('Your account has been deactivated. Please contact campus admin.', ErrorCode.ACCOUNT_BLOCKED);
    }

    // Check verified status
    if (!user.isVerified) {
      throw AppError.forbidden('Please verify your institute email before logging in.', ErrorCode.EMAIL_NOT_VERIFIED);
    }

    // Reset failed attempts on success
    await UserRepository.update(user._id, {
      failedLoginAttempts: 0,
      lockoutUntil: null,
    });

    const token = signSessionToken({
      sub: user._id.toString(),
      email: user.instituteEmail,
      role: user.role,
      messId: user.assignedMessId ? user.assignedMessId.toString() : undefined,
      tokenVersion: user.tokenVersion,
    });

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.instituteEmail,
        role: user.role,
        messId: user.assignedMessId ? user.assignedMessId.toString() : undefined,
      },
      token,
    };
  }

  static async logout(userId: string) {
    await UserRepository.bumpTokenVersion(userId);
  }

  static async forgotPassword(input: ForgotPasswordInput, correlationId: string) {
    await connectDb();
    const email = input.instituteEmail.toLowerCase().trim();
    logger.info('[AuthService] Forgot password requested', correlationId, { email });
    const user = await UserRepository.findByEmail(email);

    // Always return identical message regardless of whether user exists
    const uniformResponse = {
      message: 'If this email is registered, you will receive password reset instructions.',
    };

    if (!user || user.isBlocked) {
      return uniformResponse;
    }

    const resetToken = generateRandomToken(32);
    const resetHash = hashToken(resetToken);
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Store in otpHash field for reset token
    await UserRepository.update(user._id, {
      otpHash: resetHash,
      otpExpiresAt: expiry,
    });

    await emailService.sendPasswordResetEmail(email, `/reset-password?token=${resetToken}`);
    return uniformResponse;
  }

  static async resetPassword(input: ResetPasswordInput, correlationId: string) {
    await connectDb();
    const resetHash = hashToken(input.token);

    // Find user with matching reset token and unexpired window
    const matchedUser = await mongoose.model('User').findOne({
      otpHash: resetHash,
      otpExpiresAt: { $gt: new Date() },
    });

    if (!matchedUser) {
      throw AppError.badRequest('Password reset link is invalid or has expired.', ErrorCode.BAD_REQUEST);
    }

    logger.info('[AuthService] Resetting password', correlationId, { userId: matchedUser._id.toString() });

    const passwordHash = await hashPassword(input.newPassword);

    // Update password, clear token, and bump tokenVersion to revoke all active sessions
    await UserRepository.update(matchedUser._id, {
      passwordHash,
      otpHash: null,
      otpExpiresAt: null,
      $inc: { tokenVersion: 1 },
    });

    await AuditLogRepository.log(
      matchedUser._id,
      'PASSWORD_RESET',
      'Users',
      correlationId,
      'Password successfully reset via token'
    );

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  static async changePassword(userId: string, input: ChangePasswordInput, correlationId: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found', ErrorCode.NOT_FOUND);
    }

    const isMatch = await comparePassword(input.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw AppError.badRequest('Current password is incorrect.', ErrorCode.BAD_REQUEST);
    }

    const isSame = await comparePassword(input.newPassword, user.passwordHash);
    if (isSame) {
      throw AppError.badRequest('New password cannot be the same as your current password.', ErrorCode.BAD_REQUEST);
    }

    const passwordHash = await hashPassword(input.newPassword);

    await UserRepository.update(user._id, {
      passwordHash,
      $inc: { tokenVersion: 1 },
    });

    await AuditLogRepository.log(user._id, 'PASSWORD_CHANGE', 'Users', correlationId, 'Password changed by user');

    return { message: 'Password changed successfully.' };
  }

  static async getMe(userId: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw AppError.unauthorized('User not found', ErrorCode.UNAUTHORIZED);
    }
    return this.sanitizeUser(user);
  }
}

