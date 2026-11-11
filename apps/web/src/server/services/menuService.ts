import mongoose from 'mongoose';
import { MenuRepository } from '../repositories/MenuRepository';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { UserRepository } from '../repositories/UserRepository';
import { IMenu, MenuStatus, MealType } from '../models/Menu';
import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';
import {
  CreateMenuInput,
  UpdateMenuInput,
  PublishMenuInput,
  DishAvailabilityInput,
} from '../validators/menuValidators';
import { env } from '../config/env';

function sanitizeDishName(name: string): string {
  // Strip HTML tags and trim
  return name.replace(/<[^>]*>/g, '').trim();
}

function todayInMessTz(): string {
  return new Date()
    .toLocaleDateString('en-CA', { timeZone: env.MESS_TIMEZONE })
    .slice(0, 10); // YYYY-MM-DD
}

function sanitizeMenu(menu: IMenu) {
  return {
    id: menu._id.toString(),
    messId: menu.messId.toString(),
    serviceDate: menu.serviceDate,
    mealType: menu.mealType,
    dishes: menu.dishes.map((d) => ({
      dishId: d.dishId?.toString(),
      name: sanitizeDishName(d.name),
      category: d.category,
      isAvailable: d.isAvailable,
    })),
    status: menu.status,
    version: menu.version,
    publishedAt: menu.publishedAt,
    createdAt: menu.createdAt,
    updatedAt: menu.updatedAt,
  };
}

export class MenuService {
  // ── Create ────────────────────────────────────────────────────────────────

  static async createMenu(messId: string, input: CreateMenuInput, correlationId: string) {
    // Check for duplicate (mess, date, mealType)
    const existing = await MenuRepository.findByMealAndDate(messId, input.serviceDate, input.mealType);
    if (existing) {
      throw AppError.conflict(
        `A menu for ${input.mealType} on ${input.serviceDate} already exists for this mess.`,
        ErrorCode.CONFLICT
      );
    }

    // Deduplicate dish names case-insensitively
    const seen = new Set<string>();
    const dishes: { name: string; category: string; isAvailable: boolean; dishId: mongoose.Types.ObjectId }[] = [];
    for (const d of input.dishes) {
      const key = sanitizeDishName(d.name).toLowerCase();
      if (seen.has(key)) continue; // skip duplicate
      seen.add(key);
      dishes.push({
        dishId: new mongoose.Types.ObjectId(),
        name: sanitizeDishName(d.name),
        category: d.category,
        isAvailable: d.isAvailable,
      });
    }

    const menu = await MenuRepository.create({
      messId: new mongoose.Types.ObjectId(messId),
      serviceDate: input.serviceDate,
      mealType: input.mealType as MealType,
      dishes,
      status: MenuStatus.DRAFT,
    });

    logger.info('[MenuService] Menu created', correlationId, {
      menuId: menu._id.toString(),
      messId,
      serviceDate: input.serviceDate,
      mealType: input.mealType,
    });

    return sanitizeMenu(menu);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  static async updateMenu(
    menuId: string,
    messId: string,
    input: UpdateMenuInput,
    correlationId: string
  ) {
    const updateData: Partial<IMenu> = {};

    if (input.dishes !== undefined) {
      const seen = new Set<string>();
      updateData.dishes = [];
      for (const d of input.dishes) {
        const key = sanitizeDishName(d.name).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        updateData.dishes.push({
          dishId: new mongoose.Types.ObjectId(),
          name: sanitizeDishName(d.name),
          category: d.category,
          isAvailable: d.isAvailable,
        });
      }
    }

    const updated = await MenuRepository.updateWithVersion(
      menuId,
      messId,
      input.version,
      updateData
    );

    if (!updated) {
      // Check if menu exists at all
      const exists = await MenuRepository.findById(menuId, messId);
      if (!exists) throw AppError.notFound('Menu not found.', ErrorCode.NOT_FOUND);
      throw AppError.conflict(
        'Menu was modified by another request. Please reload and try again.',
        ErrorCode.STALE_VERSION
      );
    }

    // If published, notify students of changes
    if (updated.status === MenuStatus.PUBLISHED) {
      await this.notifyStudentsMenuUpdated(updated, correlationId);
    }

    return sanitizeMenu(updated);
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  static async publishMenu(messId: string, input: PublishMenuInput, correlationId: string) {
    const menu = await MenuRepository.findById(input.menuId, messId);
    if (!menu) throw AppError.notFound('Menu not found.', ErrorCode.NOT_FOUND);

    // Empty menu guard
    if (menu.dishes.length === 0) {
      throw AppError.unprocessable(
        'Cannot publish an empty menu. Add at least one dish first.',
        ErrorCode.EMPTY_MENU
      );
    }

    // Past date guard (allow only with explicit backfill permission + audit)
    const today = todayInMessTz();
    if (menu.serviceDate < today && !input.allowBackfill) {
      throw AppError.badRequest(
        'Cannot publish a menu for a past date without explicit backfill permission.',
        ErrorCode.BAD_REQUEST
      );
    }

    // Idempotent: already published
    if (menu.status === MenuStatus.PUBLISHED) {
      return { menu: sanitizeMenu(menu), alreadyPublished: true };
    }

    const updated = await MenuRepository.updateWithVersion(input.menuId, messId, input.version, {
      status: MenuStatus.PUBLISHED,
      publishedAt: new Date(),
    });

    if (!updated) {
      throw AppError.conflict(
        'Stale version — menu was updated. Reload and try again.',
        ErrorCode.STALE_VERSION
      );
    }

    if (input.allowBackfill && menu.serviceDate < today) {
      await AuditLogRepository.log(
        new mongoose.Types.ObjectId(messId),
        'MENU_BACKFILL_PUBLISH',
        'Menus',
        correlationId,
        `Backfill publish for ${menu.serviceDate} ${menu.mealType}`,
        menu._id
      );
    }

    // Send notifications to all students (deduplicated by eventKey)
    await this.notifyStudentsMenuPublished(updated, correlationId).catch((err) => {
      logger.warn('[MenuService] Notification dispatch failed (non-fatal)', correlationId, { err: String(err) });
    });

    return { menu: sanitizeMenu(updated), alreadyPublished: false };
  }

  // ── Dish Availability ─────────────────────────────────────────────────────

  static async setDishAvailability(
    menuId: string,
    messId: string,
    input: DishAvailabilityInput,
    correlationId: string
  ) {
    const menu = await MenuRepository.findById(menuId, messId);
    if (!menu) throw AppError.notFound('Menu not found.', ErrorCode.NOT_FOUND);

    const dishIndex = menu.dishes.findIndex(
      (d) => d.name.toLowerCase() === sanitizeDishName(input.dishName).toLowerCase()
    );
    if (dishIndex === -1) {
      throw AppError.notFound(`Dish "${input.dishName}" not found in this menu.`, ErrorCode.NOT_FOUND);
    }

    menu.dishes[dishIndex].isAvailable = input.isAvailable;

    const updated = await MenuRepository.updateWithVersion(menuId, messId, input.version, {
      dishes: menu.dishes,
    });

    if (!updated) {
      throw AppError.conflict('Stale version — please reload and retry.', ErrorCode.STALE_VERSION);
    }

    return sanitizeMenu(updated);
  }

  // ── Soft Delete ───────────────────────────────────────────────────────────

  static async deleteMenu(menuId: string, messId: string, correlationId: string) {
    const menu = await MenuRepository.findById(menuId, messId);
    if (!menu) throw AppError.notFound('Menu not found.', ErrorCode.NOT_FOUND);

    // Archive instead of hard delete if the menu has feedback (checked by FeedbackRepository in Phase 5)
    // For now, soft delete
    const deleted = await MenuRepository.softDelete(menuId, messId);
    if (!deleted) throw AppError.notFound('Menu not found.', ErrorCode.NOT_FOUND);

    logger.info('[MenuService] Menu soft-deleted', correlationId, { menuId, messId });
    return { message: 'Menu deleted successfully.' };
  }

  // ── Read — Manager ────────────────────────────────────────────────────────

  static async getMenu(menuId: string, messId: string) {
    const menu = await MenuRepository.findById(menuId, messId);
    if (!menu) throw AppError.notFound('Menu not found.', ErrorCode.NOT_FOUND);
    return sanitizeMenu(menu);
  }

  static async listMenus(
    messId: string,
    filter: { status?: string; fromDate?: string; toDate?: string; page?: number; limit?: number }
  ) {
    const result = await MenuRepository.list(messId, filter as Parameters<typeof MenuRepository.list>[1]);
    return {
      menus: result.menus.map(sanitizeMenu),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  // ── Read — Student (PUBLISHED only) ──────────────────────────────────────

  static async getTodayMenu(messId: string) {
    const today = todayInMessTz();
    const menus = await MenuRepository.findPublishedWeekly(messId, today, today);
    return menus.map(sanitizeMenu);
  }

  static async getWeeklyMenu(messId: string, startDate: string) {
    // Build 7-day range
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const endDate = end.toISOString().slice(0, 10);
    const published = await MenuRepository.findPublishedWeekly(messId, startDate, endDate);

    // Build a full 7×4 skeleton with explicit "not published" markers
    const mealTypes: MealType[] = [MealType.BREAKFAST, MealType.LUNCH, MealType.SNACKS, MealType.DINNER];
    const days: Array<{ date: string; meals: Array<{ mealType: MealType; menu: ReturnType<typeof sanitizeMenu> | null }> }> = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        meals: mealTypes.map((mt) => ({
          mealType: mt,
          menu: published.find((m) => m.serviceDate === dateStr && m.mealType === mt)
            ? sanitizeMenu(published.find((m) => m.serviceDate === dateStr && m.mealType === mt)!)
            : null,
        })),
      });
    }

    return days;
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  private static async notifyStudentsMenuPublished(menu: IMenu, correlationId: string) {
    const { users: students } = await UserRepository.list({ limit: 500 });
    const eventKey = `menu:published:${menu._id}`;

    await Promise.allSettled(
      students.map((s) =>
        NotificationRepository.create({
          userId: s._id,
          eventKey,
          title: 'Menu Published',
          message: `${menu.mealType} menu for ${menu.serviceDate} is now available.`,
          linkUrl: `/student/menu?date=${menu.serviceDate}`,
        }).catch(() => undefined) // duplicate eventKey silently ignored by unique index
      )
    );
  }

  private static async notifyStudentsMenuUpdated(menu: IMenu, correlationId: string) {
    const { users: students } = await UserRepository.list({ limit: 500 });
    const eventKey = `menu:updated:${menu._id}:v${menu.version}`;

    await Promise.allSettled(
      students.map((s) =>
        NotificationRepository.create({
          userId: s._id,
          eventKey,
          title: 'Menu Updated',
          message: `${menu.mealType} menu for ${menu.serviceDate} has been updated.`,
          linkUrl: `/student/menu?date=${menu.serviceDate}`,
        }).catch(() => undefined)
      )
    );
  }
}

