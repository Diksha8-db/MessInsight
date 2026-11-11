import mongoose from 'mongoose';
import { UserRepository } from '../repositories/UserRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { UserRole, IUser } from '../models/User';
import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import { hashPassword } from '../lib/auth';
import { emailService } from './emailService';
import { generateRandomToken, hashToken } from '../lib/auth';
import { UserListFilter } from '../repositories/UserRepository';

export interface AdminUserView {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
  isBlocked: boolean;
  messId?: string;
  createdAt: Date;
}

function sanitizeUser(user: IUser): AdminUserView {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.instituteEmail,
    role: user.role,
    isVerified: user.isVerified,
    isBlocked: user.isBlocked,
    messId: user.assignedMessId?.toString(),
    createdAt: user.createdAt,
  };
}

/** Ensure there is at least one non-blocked ADMIN left before a destructive operation. */
async function assertLastAdminProtection(targetUserId: string): Promise<void> {
  const { users: admins } = await UserRepository.list({ role: UserRole.ADMIN, isBlocked: false });
  const isLastAdmin =
    admins.length === 1 && admins[0]._id.toString() === targetUserId;
  if (isLastAdmin) {
    throw AppError.forbidden(
      'Cannot perform this action: at least one admin must remain active.',
      ErrorCode.FORBIDDEN
    );
  }
}

export class AdminService {
  // ── Users ─────────────────────────────────────────────────────────────────

  static async listUsers(filter: UserListFilter) {
    const result = await UserRepository.list(filter);
    return {
      users: result.users.map(sanitizeUser),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  static async getUser(targetId: string): Promise<AdminUserView> {
    const user = await UserRepository.findById(targetId);
    if (!user) throw AppError.notFound('User not found.', ErrorCode.NOT_FOUND);
    return sanitizeUser(user);
  }

  // ── Block / Unblock ───────────────────────────────────────────────────────

  static async blockUser(adminId: string, targetId: string, correlationId: string) {
    if (adminId === targetId) {
      throw AppError.badRequest('You cannot block your own account.', ErrorCode.BAD_REQUEST);
    }
    const target = await UserRepository.findById(targetId);
    if (!target) throw AppError.notFound('User not found.', ErrorCode.NOT_FOUND);
    if (target.isBlocked) {
      throw AppError.conflict('User is already blocked.', ErrorCode.CONFLICT);
    }
    if (target.role === UserRole.ADMIN) {
      await assertLastAdminProtection(targetId);
    }

    // Bump tokenVersion to immediately invalidate any active session
    await UserRepository.update(target._id, { isBlocked: true, $inc: { tokenVersion: 1 } });

    await AuditLogRepository.log(
      new mongoose.Types.ObjectId(adminId),
      'ADMIN_BLOCK_USER',
      'Users',
      correlationId,
      `Admin blocked user ${target.instituteEmail}`,
      target._id
    );

    logger.info('[AdminService] User blocked', correlationId, { targetId });
    return { message: `User ${target.name} has been blocked.` };
  }

  static async unblockUser(adminId: string, targetId: string, correlationId: string) {
    const target = await UserRepository.findById(targetId);
    if (!target) throw AppError.notFound('User not found.', ErrorCode.NOT_FOUND);
    if (!target.isBlocked) {
      throw AppError.conflict('User is not blocked.', ErrorCode.CONFLICT);
    }

    await UserRepository.update(target._id, { isBlocked: false });

    await AuditLogRepository.log(
      new mongoose.Types.ObjectId(adminId),
      'ADMIN_UNBLOCK_USER',
      'Users',
      correlationId,
      `Admin unblocked user ${target.instituteEmail}`,
      target._id
    );

    return { message: `User ${target.name} has been unblocked.` };
  }

  // ── Manager Assignment ────────────────────────────────────────────────────

  static async assignManager(
    adminId: string,
    targetId: string,
    messId: string,
    correlationId: string
  ) {
    const target = await UserRepository.findById(targetId);
    if (!target) throw AppError.notFound('User not found.', ErrorCode.NOT_FOUND);
    if (!target.isVerified) {
      throw AppError.badRequest('Cannot promote an unverified user to manager.', ErrorCode.BAD_REQUEST);
    }
    if (target.isBlocked) {
      throw AppError.badRequest('Cannot assign a blocked user as manager.', ErrorCode.BAD_REQUEST);
    }

    const before = { role: target.role, messId: target.assignedMessId?.toString() };

    await UserRepository.update(target._id, {
      role: UserRole.MANAGER,
      assignedMessId: new mongoose.Types.ObjectId(messId),
      $inc: { tokenVersion: 1 }, // Role change takes effect immediately
    });

    await AuditLogRepository.log(
      new mongoose.Types.ObjectId(adminId),
      'ADMIN_ASSIGN_MANAGER',
      'Users',
      correlationId,
      `Admin assigned ${target.instituteEmail} as manager for mess ${messId}. Before: role=${before.role}, messId=${before.messId}`,
      target._id
    );

    return { message: `${target.name} has been assigned as manager for mess ${messId}.` };
  }

  static async removeManager(adminId: string, targetId: string, correlationId: string) {
    const target = await UserRepository.findById(targetId);
    if (!target) throw AppError.notFound('User not found.', ErrorCode.NOT_FOUND);
    if (target.role !== UserRole.MANAGER) {
      throw AppError.badRequest('User is not a manager.', ErrorCode.BAD_REQUEST);
    }

    await UserRepository.update(target._id, {
      role: UserRole.STUDENT,
      assignedMessId: null,
      $inc: { tokenVersion: 1 },
    });

    await AuditLogRepository.log(
      new mongoose.Types.ObjectId(adminId),
      'ADMIN_REMOVE_MANAGER',
      'Users',
      correlationId,
      `Admin revoked manager role from ${target.instituteEmail}`,
      target._id
    );

    return { message: `${target.name} has been demoted to student.` };
  }

  // ── Admin Password Reset (token flow) ─────────────────────────────────────

  static async adminResetPassword(adminId: string, targetId: string, correlationId: string) {
    const target = await UserRepository.findById(targetId);
    if (!target) throw AppError.notFound('User not found.', ErrorCode.NOT_FOUND);

    const resetToken = generateRandomToken(32);
    const resetHash = hashToken(resetToken);
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await UserRepository.update(target._id, {
      otpHash: resetHash,
      otpExpiresAt: expiry,
      $inc: { tokenVersion: 1 }, // Revoke existing sessions
    });

    await emailService.sendPasswordResetEmail(
      target.instituteEmail,
      `/reset-password?token=${resetToken}`
    );

    await AuditLogRepository.log(
      new mongoose.Types.ObjectId(adminId),
      'ADMIN_RESET_PASSWORD',
      'Users',
      correlationId,
      `Admin initiated password reset for ${target.instituteEmail}`,
      target._id
    );

    return { message: `Password reset email sent to ${target.instituteEmail}.` };
  }

  // ── Remove Fake Account (Anonymise) ───────────────────────────────────────

  static async removeUser(adminId: string, targetId: string, correlationId: string) {
    if (adminId === targetId) {
      throw AppError.badRequest('You cannot remove your own account.', ErrorCode.BAD_REQUEST);
    }
    const target = await UserRepository.findById(targetId);
    if (!target) throw AppError.notFound('User not found.', ErrorCode.NOT_FOUND);
    if (target.role === UserRole.ADMIN) {
      await assertLastAdminProtection(targetId);
    }

    await UserRepository.anonymize(target._id);

    await AuditLogRepository.log(
      new mongoose.Types.ObjectId(adminId),
      'ADMIN_REMOVE_USER',
      'Users',
      correlationId,
      `Admin anonymised/removed account for ${target.instituteEmail}`,
      target._id
    );

    return { message: `User account has been permanently removed.` };
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────

  static async listAuditLogs(page = 1, limit = 50) {
    return AuditLogRepository.list(page, limit);
  }

  // ── Campus Stats ──────────────────────────────────────────────────────────

  static async getStats() {
    const [
      { total: totalUsers },
      { total: totalManagers },
      { total: blockedUsers },
      { total: unverifiedUsers },
    ] = await Promise.all([
      UserRepository.list({ limit: 1 }),
      UserRepository.list({ role: UserRole.MANAGER, limit: 1 }),
      UserRepository.list({ isBlocked: true, limit: 1 }),
      UserRepository.list({ limit: 1 }),
    ]);

    return {
      totalUsers,
      totalManagers,
      blockedUsers,
      unverifiedUsers,
    };
  }
}

