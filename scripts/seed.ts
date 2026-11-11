import mongoose from 'mongoose';
import {
  UserModel,
  UserRole,
  MenuModel,
  DishModel,
  DishCategory,
  MealType,
  MenuStatus,
  SettingsModel,
  AllowedUnit,
} from '../apps/web/src/server/models';

/**
 * MessInsight Database Seeding Script
 * STRICT RULE: Refuses execution when NODE_ENV=production
 */
export async function runSeed(mongoUri?: string) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[SECURITY ERROR] Seeding is strictly forbidden in production environments!');
  }

  const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/messinsight_dev';
  console.log(`[Seed] Connecting to MongoDB at ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:[REDACTED]@')}`);

  let isConnectedLocal = false;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
    isConnectedLocal = true;
  }

  try {
    console.log('[Seed] Clearing existing collections (development only)...');
    await Promise.all([
      UserModel.deleteMany({}),
      MenuModel.deleteMany({}),
      DishModel.deleteMany({}),
      SettingsModel.deleteMany({}),
    ]);

    const dummyMessId = new mongoose.Types.ObjectId();

    console.log('[Seed] Creating demo users...');
    // Using pre-hashed placeholder for development
    const sampleHash = '$2b$10$abcdefghijklmnopqrstuv1234567890abcdefghijklmnopqrstuv';

    const [admin, manager, student1, student2] = await Promise.all([
      UserModel.create({
        name: 'Campus Administrator',
        instituteEmail: 'admin@college.edu',
        passwordHash: sampleHash,
        role: UserRole.ADMIN,
        isVerified: true,
      }),
      UserModel.create({
        name: 'Hostel A Mess Manager',
        instituteEmail: 'manager.hostela@college.edu',
        passwordHash: sampleHash,
        role: UserRole.MANAGER,
        assignedMessId: dummyMessId,
        isVerified: true,
      }),
      UserModel.create({
        name: 'Aarav Sharma (Student)',
        instituteEmail: 'aarav.sharma@college.edu',
        passwordHash: sampleHash,
        role: UserRole.STUDENT,
        isVerified: true,
      }),
      UserModel.create({
        name: 'Diya Patel (Student)',
        instituteEmail: 'diya.patel@college.edu',
        passwordHash: sampleHash,
        role: UserRole.STUDENT,
        isVerified: true,
      }),
    ]);

    console.log(`[Seed] Users created: 1 Admin (${admin.instituteEmail}), 1 Manager (${manager.instituteEmail}), 2 Students`);

    console.log('[Seed] Creating sample dishes...');
    const dishes = await DishModel.insertMany([
      { messId: dummyMessId, name: 'Dal Makhani', category: DishCategory.MAIN_COURSE, aliases: ['dal', 'daal'], isAvailable: true },
      { messId: dummyMessId, name: 'Jeera Rice', category: DishCategory.MAIN_COURSE, aliases: ['chawal', 'rice'], isAvailable: true },
      { messId: dummyMessId, name: 'Paneer Butter Masala', category: DishCategory.MAIN_COURSE, aliases: ['paneer'], isAvailable: true },
      { messId: dummyMessId, name: 'Tandoori Roti', category: DishCategory.BREAD, aliases: ['roti', 'chapati'], isAvailable: true },
      { messId: dummyMessId, name: 'Green Salad', category: DishCategory.SIDE_DISH, aliases: ['salad'], isAvailable: true },
      { messId: dummyMessId, name: 'Gulab Jamun', category: DishCategory.DESSERT, aliases: ['mithai'], isAvailable: true },
    ]);

    console.log(`[Seed] Created ${dishes.length} dishes.`);

    console.log('[Seed] Creating today published menu...');
    const todayStr = new Date().toISOString().split('T')[0];

    const menu = await MenuModel.create({
      messId: dummyMessId,
      serviceDate: todayStr,
      mealType: MealType.LUNCH,
      status: MenuStatus.PUBLISHED,
      version: 1,
      publishedAt: new Date(),
      dishes: dishes.map((d) => ({
        dishId: d._id,
        name: d.name,
        category: d.category,
        isAvailable: true,
      })),
    });

    console.log(`[Seed] Created Menu for ${todayStr} (${menu.mealType}) with ID: ${menu._id}`);

    console.log('[Seed] Creating Mess Settings...');
    await SettingsModel.create({
      messId: dummyMessId,
      feedbackEditWindowMinutes: 30,
      defaultSafetyBufferPct: 10,
      servingStandards: [
        { ingredient: 'Rice', amountPerPerson: 100, unit: AllowedUnit.G },
        { ingredient: 'Dal', amountPerPerson: 120, unit: AllowedUnit.G },
        { ingredient: 'Paneer', amountPerPerson: 80, unit: AllowedUnit.G },
        { ingredient: 'Roti', amountPerPerson: 3, unit: AllowedUnit.COUNT },
      ],
    });

    console.log('[Seed] Completed database seeding successfully.');
    return { admin, manager, student1, student2, menu, dummyMessId };
  } finally {
    if (isConnectedLocal) {
      await mongoose.disconnect();
    }
  }
}

if (require.main === module) {
  runSeed().catch((err) => {
    console.error('[Seed Failed]', err);
    process.exit(1);
  });
}
