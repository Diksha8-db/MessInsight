import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  UserRepository,
  MenuRepository,
  FeedbackRepository,
  AttendanceRepository,
  WasteRepository,
  NotificationRepository,
  AuditLogRepository,
} from '../server/repositories';
import {
  UserModel,
  MenuModel,
  FeedbackModel,
  AttendanceRecordModel,
  WasteRecordModel,
  NotificationModel,
  AuditLogModel,
  UserRole,
  MealType,
  MenuStatus,
  AllowedUnit,
} from '../server/models';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  // Ensure all model indexes are created in mongodb-memory-server
  await Promise.all([
    UserModel.syncIndexes(),
    MenuModel.syncIndexes(),
    FeedbackModel.syncIndexes(),
    AttendanceRecordModel.syncIndexes(),
    WasteRecordModel.syncIndexes(),
    NotificationModel.syncIndexes(),
    AuditLogModel.syncIndexes(),
  ]);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear collections between tests for absolute isolation
  await Promise.all([
    UserModel.deleteMany({}),
    MenuModel.deleteMany({}),
    FeedbackModel.deleteMany({}),
    AttendanceRecordModel.deleteMany({}),
    WasteRecordModel.deleteMany({}),
    NotificationModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
  ]);
});

describe('Phase 1: Repositories & Database Layer', () => {
  describe('User Validation & Duplicate Rejection', () => {
    it('rejects user without required fields or with invalid enum role', async () => {
      // Missing email
      await expect(
        UserRepository.create({
          name: 'Test Student',
          passwordHash: 'dummy_hash',
        })
      ).rejects.toThrow(/Institute email is required/);

      // Invalid role
      await expect(
        UserRepository.create({
          name: 'Invalid Role User',
          instituteEmail: 'test@college.edu',
          passwordHash: 'dummy_hash',
          role: 'SUPERADMIN' as unknown as UserRole,
        })
      ).rejects.toThrow();
    });

    it('rejects duplicate email case-insensitively (AUTH-01/DB)', async () => {
      await UserRepository.create({
        name: 'First User',
        instituteEmail: 'student@college.edu',
        passwordHash: 'hash1',
      });

      // Second insert with uppercase email must fail with duplicate key (code 11000)
      await expect(
        UserRepository.create({
          name: 'Duplicate User',
          instituteEmail: 'STUDENT@college.edu',
          passwordHash: 'hash2',
        })
      ).rejects.toThrow();
    });

    it('pagination returns correct totals and subsets', async () => {
      for (let i = 1; i <= 5; i++) {
        await UserRepository.create({
          name: `Student ${i}`,
          instituteEmail: `student${i}@college.edu`,
          passwordHash: `hash${i}`,
        });
      }

      const result = await UserRepository.list({ page: 1, limit: 2 });
      expect(result.total).toBe(5);
      expect(result.users.length).toBe(2);
      expect(result.totalPages).toBe(3);
    });

    it('anonymizes PII on user deletion and bumps tokenVersion', async () => {
      const user = await UserRepository.create({
        name: 'Private Student',
        instituteEmail: 'private@college.edu',
        passwordHash: 'superSecretHash',
      });

      const anonymized = await UserRepository.anonymize(user._id);
      expect(anonymized).not.toBeNull();
      expect(anonymized?.name).toBe('Anonymized User');
      expect(anonymized?.instituteEmail).toContain('anonymized.local');
      expect(anonymized?.passwordHash).toBe('[ANONYMIZED]');
      expect(anonymized?.isBlocked).toBe(true);
      expect(anonymized?.tokenVersion).toBe(1);
    });
  });

  describe('Menu Repository & Optimistic Concurrency', () => {
    const messId = new mongoose.Types.ObjectId();

    it('rejects duplicate menus for same mess, date, and mealType (MENU-02)', async () => {
      await MenuRepository.create({
        messId,
        serviceDate: '2026-11-15',
        mealType: MealType.LUNCH,
        status: MenuStatus.DRAFT,
      });

      await expect(
        MenuRepository.create({
          messId,
          serviceDate: '2026-11-15',
          mealType: MealType.LUNCH,
          status: MenuStatus.PUBLISHED,
        })
      ).rejects.toThrow();
    });

    it('handles optimistic concurrency with version field (STALE_VERSION)', async () => {
      const menu = await MenuRepository.create({
        messId,
        serviceDate: '2026-11-16',
        mealType: MealType.DINNER,
        status: MenuStatus.DRAFT,
      });

      expect(menu.version).toBe(1);

      // Client A updates with version 1 -> succeeds, version becomes 2
      const updatedA = await MenuRepository.updateWithVersion(menu._id, messId, 1, {
        status: MenuStatus.PUBLISHED,
      });
      expect(updatedA).not.toBeNull();
      expect(updatedA?.version).toBe(2);

      // Client B attempts update with stale version 1 -> returns null (conflict)
      const staleAttempt = await MenuRepository.updateWithVersion(menu._id, messId, 1, {
        status: MenuStatus.ARCHIVED,
      });
      expect(staleAttempt).toBeNull();
    });
  });

  describe('Feedback Duplicate Prevention & Concurrency', () => {
    const studentId = new mongoose.Types.ObjectId();
    const otherStudentId = new mongoose.Types.ObjectId();
    const menuId = new mongoose.Types.ObjectId();
    const messId = new mongoose.Types.ObjectId();

    it('rejects invalid ratings: 0, 6, 3.5, non-integers (FDBK-01)', async () => {
      await expect(
        FeedbackRepository.create({
          studentId,
          menuId,
          messId,
          serviceDate: '2026-11-15',
          mealType: MealType.LUNCH,
          overallRating: 0,
        })
      ).rejects.toThrow(/Rating must be at least 1/);

      await expect(
        FeedbackRepository.create({
          studentId,
          menuId,
          messId,
          serviceDate: '2026-11-15',
          mealType: MealType.LUNCH,
          overallRating: 6,
        })
      ).rejects.toThrow(/Rating cannot exceed 5/);

      await expect(
        FeedbackRepository.create({
          studentId,
          menuId,
          messId,
          serviceDate: '2026-11-15',
          mealType: MealType.LUNCH,
          overallRating: 3.5,
        })
      ).rejects.toThrow(/must be an integer/);
    });

    it('under 20 concurrent inserts for the same student and menu, exactly one succeeds (FDBK-07)', async () => {
      const concurrentAttempts = 20;
      const promises = Array.from({ length: concurrentAttempts }).map((_, i) =>
        FeedbackRepository.create({
          studentId,
          menuId,
          messId,
          serviceDate: '2026-11-15',
          mealType: MealType.LUNCH,
          overallRating: 4,
          comments: `Concurrent attempt ${i}`,
        })
      );

      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(19);
    });

    it('ownership filter prevents reading another student feedback', async () => {
      const fb = await FeedbackRepository.create({
        studentId,
        menuId,
        messId,
        serviceDate: '2026-11-15',
        mealType: MealType.LUNCH,
        overallRating: 5,
      });

      // Reading with correct owner
      const foundOwner = await FeedbackRepository.findById(fb._id, studentId);
      expect(foundOwner).not.toBeNull();
      expect(foundOwner?._id.toString()).toBe(fb._id.toString());

      // Reading with another student id returns null
      const foundOther = await FeedbackRepository.findById(fb._id, otherStudentId);
      expect(foundOther).toBeNull();
    });

    it('excludes soft-deleted feedback from default queries', async () => {
      const fb = await FeedbackRepository.create({
        studentId,
        menuId,
        messId,
        serviceDate: '2026-11-15',
        mealType: MealType.LUNCH,
        overallRating: 5,
      });

      await FeedbackRepository.softDelete(fb._id, studentId);

      const found = await FeedbackRepository.findById(fb._id, studentId);
      expect(found).toBeNull();

      const history = await FeedbackRepository.listStudentHistory(studentId);
      expect(history.total).toBe(0);
    });
  });

  describe('Attendance, Waste, Notifications & Audit Repositories', () => {
    const messId = new mongoose.Types.ObjectId();
    const managerId = new mongoose.Types.ObjectId();

    it('attendance enforces uniqueness and accepts 0 as valid value (PRED-04)', async () => {
      const zeroAttendance = await AttendanceRepository.create({
        messId,
        serviceDate: '2026-11-15',
        mealType: MealType.LUNCH,
        actualAttendance: 0, // 0 is completely valid (holiday/mess closure)
        recordedBy: managerId,
      });
      expect(zeroAttendance.actualAttendance).toBe(0);

      // Duplicate date and meal throws
      await expect(
        AttendanceRepository.create({
          messId,
          serviceDate: '2026-11-15',
          mealType: MealType.LUNCH,
          actualAttendance: 100,
          recordedBy: managerId,
        })
      ).rejects.toThrow();
    });

    it('waste record enforces leftover/consumed <= prepared and whitelisted units (WAST-01)', async () => {
      // Leftover > prepared must fail
      await expect(
        WasteRepository.create({
          messId,
          serviceDate: '2026-11-15',
          mealType: MealType.DINNER,
          ingredient: 'Rice',
          preparedQuantity: 50,
          consumedQuantity: 30,
          leftoverQuantity: 60, // impossible
          unit: AllowedUnit.KG,
          recordedBy: managerId,
        })
      ).rejects.toThrow(/Leftover quantity cannot exceed prepared quantity/);

      // Invalid unit Whitelist
      await expect(
        WasteRepository.create({
          messId,
          serviceDate: '2026-11-15',
          mealType: MealType.DINNER,
          ingredient: 'Rice',
          preparedQuantity: 50,
          consumedQuantity: 30,
          leftoverQuantity: 15,
          unit: 'pounds' as unknown as AllowedUnit,
          recordedBy: managerId,
        })
      ).rejects.toThrow();

      // Valid waste record calculates unaccountedDiff
      const valid = await WasteRepository.create({
        messId,
        serviceDate: '2026-11-15',
        mealType: MealType.DINNER,
        ingredient: 'Rice',
        preparedQuantity: 50,
        consumedQuantity: 35,
        leftoverQuantity: 10,
        unit: AllowedUnit.KG,
        recordedBy: managerId,
      });
      expect(valid.unaccountedDiff).toBe(5);
    });

    it('notification deduplicates by (userId, eventKey)', async () => {
      const userId = new mongoose.Types.ObjectId();
      const eventKey = 'menu_publish_2026-11-15_LUNCH';

      await NotificationRepository.create({
        userId,
        eventKey,
        title: 'Menu Published',
        message: 'Lunch menu is published.',
      });

      // Second insert with same eventKey throws duplicate key
      await expect(
        NotificationRepository.create({
          userId,
          eventKey,
          title: 'Menu Published',
          message: 'Lunch menu is published.',
        })
      ).rejects.toThrow();
    });

    it('audit log scrubs sensitive data from summaries', async () => {
      const actorId = new mongoose.Types.ObjectId();
      const log = await AuditLogRepository.log(
        actorId,
        'USER_PASSWORD_RESET',
        'Users',
        'corr-1234',
        'Password reset with password=superSecretPass123 for user'
      );

      expect(log.summary).not.toContain('superSecretPass123');
      expect(log.summary).toContain('password=[REDACTED]');
    });
  });
});

