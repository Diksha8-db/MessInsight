import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MenuService } from '../server/services/menuService';
import { AuthService } from '../server/services/authService';
import { MenuModel, MenuStatus, MealType } from '../server/models/Menu';
import { UserModel, UserRole } from '../server/models/User';
import { NotificationModel } from '../server/models/Notification';
import { AuditLogModel } from '../server/models/AuditLog';
import { emailService, devEmailSink } from '../server/services/emailService';
import { AppError, ErrorCode } from '../server/lib/errors';

let mongoServer: MongoMemoryServer;
let messId: string;
let anotherMessId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await Promise.all([
    MenuModel.syncIndexes(),
    UserModel.syncIndexes(),
    NotificationModel.syncIndexes(),
    AuditLogModel.syncIndexes(),
  ]);
  messId = new mongoose.Types.ObjectId().toString();
  anotherMessId = new mongoose.Types.ObjectId().toString();
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    MenuModel.deleteMany({}),
    NotificationModel.deleteMany({}),
    AuditLogModel.deleteMany({}),
  ]);
  devEmailSink.clear();
  emailService.setSimulateFailure(false);
});

const baseMenu = {
  serviceDate: '2027-03-15',
  mealType: MealType.LUNCH,
  dishes: [
    { name: 'Dal Tadka', category: 'MAIN', isAvailable: true },
    { name: 'Rice', category: 'STAPLE', isAvailable: true },
  ],
};

describe('Phase 4: Menu Management (MENU-01 to MENU-14)', () => {

  // ── MENU-01: Create menu ──────────────────────────────────────────────────
  it('MENU-01: manager creates a valid DRAFT menu', async () => {
    const menu = await MenuService.createMenu(messId, baseMenu, 'corr-m1');
    expect(menu.status).toBe(MenuStatus.DRAFT);
    expect(menu.mealType).toBe(MealType.LUNCH);
    expect(menu.serviceDate).toBe('2027-03-15');
    expect(menu.dishes).toHaveLength(2);
    expect(menu.version).toBe(1);
  });

  // ── MENU-02: Duplicate (mess, date, mealType) → 409 ──────────────────────
  it('MENU-02: duplicate (messId, serviceDate, mealType) returns 409 CONFLICT', async () => {
    await MenuService.createMenu(messId, baseMenu, 'corr-m2a');
    await expect(MenuService.createMenu(messId, baseMenu, 'corr-m2b')).rejects.toMatchObject({
      statusCode: 409,
      code: ErrorCode.CONFLICT,
    });
  });

  // ── MENU-03: Duplicate dishes de-duplicated case-insensitively ────────────
  it('MENU-03: duplicate dish names within a menu are de-duplicated case-insensitively', async () => {
    const menu = await MenuService.createMenu(
      messId,
      {
        serviceDate: '2027-03-16',
        mealType: MealType.BREAKFAST,
        dishes: [
          { name: 'Poha', category: 'MAIN', isAvailable: true },
          { name: 'poha', category: 'MAIN', isAvailable: true }, // duplicate
          { name: 'Tea', category: 'BEVERAGE', isAvailable: true },
        ],
      },
      'corr-m3'
    );
    expect(menu.dishes).toHaveLength(2); // poha deduped
  });

  // ── MENU-04: Publish empty menu → 422 EMPTY_MENU ─────────────────────────
  it('MENU-04: publishing empty menu returns 422 EMPTY_MENU', async () => {
    const menu = await MenuService.createMenu(
      messId,
      { serviceDate: '2027-03-17', mealType: MealType.DINNER, dishes: [] },
      'corr-m4'
    );
    await expect(
      MenuService.publishMenu(messId, { menuId: menu.id, version: menu.version, allowBackfill: false }, 'corr-m4p')
    ).rejects.toMatchObject({ statusCode: 422, code: ErrorCode.EMPTY_MENU });
  });

  // ── MENU-05: Publish past date without backfill flag → 400 ───────────────
  it('MENU-05: publishing past date without backfill permission returns 400', async () => {
    const menu = await MenuService.createMenu(
      messId,
      { serviceDate: '2020-01-01', mealType: MealType.LUNCH, dishes: [{ name: 'Dal', category: 'MAIN', isAvailable: true }] },
      'corr-m5'
    );
    await expect(
      MenuService.publishMenu(messId, { menuId: menu.id, version: menu.version, allowBackfill: false }, 'corr-m5p')
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ── MENU-06: Publish past date WITH backfill flag → succeeds ─────────────
  it('MENU-06: publishing past date with allowBackfill=true succeeds and writes audit log', async () => {
    const menu = await MenuService.createMenu(
      messId,
      { serviceDate: '2020-01-01', mealType: MealType.BREAKFAST, dishes: [{ name: 'Idli', category: 'MAIN', isAvailable: true }] },
      'corr-m6'
    );
    const result = await MenuService.publishMenu(
      messId,
      { menuId: menu.id, version: menu.version, allowBackfill: true },
      'corr-m6p'
    );
    expect(result.menu.status).toBe(MenuStatus.PUBLISHED);
    const auditLogs = await AuditLogModel.find({ action: 'MENU_BACKFILL_PUBLISH' });
    expect(auditLogs).toHaveLength(1);
  });

  // ── MENU-07: Publish is idempotent ────────────────────────────────────────
  it('MENU-07: publishing an already-published menu is idempotent', async () => {
    const menu = await MenuService.createMenu(messId, baseMenu, 'corr-m7');
    await MenuService.publishMenu(messId, { menuId: menu.id, version: menu.version, allowBackfill: false }, 'corr-m7p1');
    // Publish again
    const result = await MenuService.publishMenu(
      messId,
      { menuId: menu.id, version: menu.version + 1, allowBackfill: false },
      'corr-m7p2'
    );
    expect(result.alreadyPublished).toBe(true);
  });

  // ── MENU-08: Optimistic concurrency → 409 STALE_VERSION ──────────────────
  it('MENU-08: concurrent edit with wrong version returns 409 STALE_VERSION', async () => {
    const menu = await MenuService.createMenu(messId, baseMenu, 'corr-m8');
    // First update succeeds (version 1 → 2)
    await MenuService.updateMenu(menu.id, messId, { dishes: [{ name: 'Chapati', category: 'BREAD', isAvailable: true }], version: 1 }, 'corr-m8a');
    // Second update with stale version 1 fails
    await expect(
      MenuService.updateMenu(menu.id, messId, { dishes: [{ name: 'Naan', category: 'BREAD', isAvailable: true }], version: 1 }, 'corr-m8b')
    ).rejects.toMatchObject({ statusCode: 409, code: ErrorCode.STALE_VERSION });
  });

  // ── MENU-09: Soft delete removes menu from default queries ────────────────
  it('MENU-09: soft delete hides menu from list and getMenu', async () => {
    const menu = await MenuService.createMenu(messId, baseMenu, 'corr-m9');
    await MenuService.deleteMenu(menu.id, messId, 'corr-m9d');
    await expect(MenuService.getMenu(menu.id, messId)).rejects.toMatchObject({ statusCode: 404 });
    const list = await MenuService.listMenus(messId, {});
    expect(list.menus.find((m) => m.id === menu.id)).toBeUndefined();
  });

  // ── MENU-10: Manager of another mess cannot access this mess menu ─────────
  it('MENU-10: manager of mess A cannot access mess B menu (messId scope)', async () => {
    const menu = await MenuService.createMenu(messId, baseMenu, 'corr-m10');
    await expect(MenuService.getMenu(menu.id, anotherMessId)).rejects.toMatchObject({ statusCode: 404 });
  });

  // ── MENU-11: Dish availability toggle ─────────────────────────────────────
  it('MENU-11: marking a dish unavailable updates status correctly', async () => {
    const menu = await MenuService.createMenu(messId, baseMenu, 'corr-m11');
    const updated = await MenuService.setDishAvailability(
      menu.id,
      messId,
      { dishName: 'Dal Tadka', isAvailable: false, version: 1 },
      'corr-m11a'
    );
    const dalDish = updated.dishes.find((d) => d.name === 'Dal Tadka');
    expect(dalDish?.isAvailable).toBe(false);
  });

  // ── MENU-12: dish availability for non-existent dish → 404 ───────────────
  it('MENU-12: toggling unavailable dish that does not exist returns 404', async () => {
    const menu = await MenuService.createMenu(messId, baseMenu, 'corr-m12');
    await expect(
      MenuService.setDishAvailability(menu.id, messId, { dishName: 'Nonexistent Dish', isAvailable: false, version: 1 }, 'corr-m12a')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ── MENU-13: Students can only see PUBLISHED menus ────────────────────────
  it('MENU-13: student getTodayMenu returns only PUBLISHED menus', async () => {
    // Draft — should NOT appear
    await MenuService.createMenu(
      messId,
      { serviceDate: new Date().toISOString().slice(0, 10), mealType: MealType.LUNCH, dishes: [{ name: 'Dal', category: 'MAIN', isAvailable: true }] },
      'corr-m13d'
    );
    const todayMenus = await MenuService.getTodayMenu(messId);
    expect(todayMenus).toHaveLength(0);
  });

  // ── MENU-14: Weekly menu returns exactly 7 days ───────────────────────────
  it('MENU-14: getWeeklyMenu returns exactly 7 dates with 4 meal slots each', async () => {
    const weekly = await MenuService.getWeeklyMenu(messId, '2027-03-01');
    expect(weekly).toHaveLength(7);
    for (const day of weekly) {
      expect(day.meals).toHaveLength(4); // BREAKFAST, LUNCH, SNACKS, DINNER
    }
    expect(weekly[0].date).toBe('2027-03-01');
    expect(weekly[6].date).toBe('2027-03-07');
  });

  // ── XSS sanitation ────────────────────────────────────────────────────────
  it('XSS: dish name containing HTML tags is stripped on storage', async () => {
    const menu = await MenuService.createMenu(
      messId,
      {
        serviceDate: '2027-04-01',
        mealType: MealType.SNACKS,
        dishes: [{ name: '<script>alert(1)</script>Samosa', category: 'SNACK', isAvailable: true }],
      },
      'corr-xss'
    );
    expect(menu.dishes[0].name).not.toContain('<script>');
    expect(menu.dishes[0].name).toContain('Samosa');
  });

  // ── Concurrency test: two concurrent edits ────────────────────────────────
  it('MENU-08b: two concurrent edits with same version — exactly one succeeds', async () => {
    const menu = await MenuService.createMenu(messId, baseMenu, 'corr-conc');
    const results = await Promise.allSettled([
      MenuService.updateMenu(menu.id, messId, { dishes: [{ name: 'Roti', category: 'BREAD', isAvailable: true }], version: 1 }, 'corr-conc-a'),
      MenuService.updateMenu(menu.id, messId, { dishes: [{ name: 'Naan', category: 'BREAD', isAvailable: true }], version: 1 }, 'corr-conc-b'),
    ]);
    const successes = results.filter((r) => r.status === 'fulfilled');
    const failures = results.filter((r) => r.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});

