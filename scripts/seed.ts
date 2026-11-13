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
  AttendanceRecordModel,
  WasteRecordModel,
  FeedbackModel,
  ComplaintModel,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  SentimentLabel,
  SentimentStatus,
  ModerationStatus,
} from '../apps/web/src/server/models';

/**
 * MessInsight Database Seeding Script
 * Populates realistic initial data for development & testing.
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
    console.log('[Seed] Clearing existing demo collections...');
    await Promise.all([
      UserModel.deleteMany({}),
      MenuModel.deleteMany({}),
      DishModel.deleteMany({}),
      SettingsModel.deleteMany({}),
      AttendanceRecordModel.deleteMany({}),
      WasteRecordModel.deleteMany({}),
      FeedbackModel.deleteMany({}),
      ComplaintModel.deleteMany({}),
    ]);

    const dummyMessId = new mongoose.Types.ObjectId();

    const domain = (process.env.INSTITUTE_EMAIL_DOMAIN || 'nitp.ac.in').toLowerCase().trim();
    console.log(`[Seed] Creating demo users for domain @${domain} (Password: Password@123)...`);
    // Pre-computed bcrypt hash of "Password@123"
    const defaultPasswordHash = '$2b$10$jogm82M.24jwZWMyO/VtaOmFlj0iKaw26.eeOz3qn7gcMSSetvvOG';

    const [admin, manager, student1, student2] = await Promise.all([
      UserModel.create({
        name: 'Campus Administrator',
        instituteEmail: `admin@${domain}`,
        passwordHash: defaultPasswordHash,
        role: UserRole.ADMIN,
        isVerified: true,
      }),
      UserModel.create({
        name: 'Hostel A Mess Manager',
        instituteEmail: `manager.hostela@${domain}`,
        passwordHash: defaultPasswordHash,
        role: UserRole.MANAGER,
        assignedMessId: dummyMessId,
        isVerified: true,
      }),
      UserModel.create({
        name: 'Aarav Sharma',
        instituteEmail: `aarav.sharma@${domain}`,
        passwordHash: defaultPasswordHash,
        role: UserRole.STUDENT,
        isVerified: true,
      }),
      UserModel.create({
        name: 'Diya Patel',
        instituteEmail: `diya.patel@${domain}`,
        passwordHash: defaultPasswordHash,
        role: UserRole.STUDENT,
        isVerified: true,
      }),
    ]);

    console.log(`[Seed] Created users: 1 Admin, 1 Manager, 2 Students`);

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

    console.log('[Seed] Creating published menus...');
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

    console.log('[Seed] Creating historical attendance records (past 14 days)...');
    const attendanceRecords = [];
    const baseDate = new Date();
    for (let i = 14; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // Breakfast, Lunch, Dinner records
      attendanceRecords.push({
        messId: dummyMessId,
        serviceDate: dateStr,
        mealType: MealType.BREAKFAST,
        actualAttendance: 320 + Math.floor(Math.sin(i) * 30),
        recordedBy: manager._id,
        isManualEdit: false,
      });
      attendanceRecords.push({
        messId: dummyMessId,
        serviceDate: dateStr,
        mealType: MealType.LUNCH,
        actualAttendance: 480 + Math.floor(Math.cos(i) * 40),
        recordedBy: manager._id,
        isManualEdit: false,
      });
      attendanceRecords.push({
        messId: dummyMessId,
        serviceDate: dateStr,
        mealType: MealType.DINNER,
        actualAttendance: 450 + Math.floor(Math.sin(i + 1) * 35),
        recordedBy: manager._id,
        isManualEdit: false,
      });
    }
    await AttendanceRecordModel.insertMany(attendanceRecords);

    console.log('[Seed] Creating waste records...');
    const wasteRecords = [
      {
        messId: dummyMessId,
        serviceDate: todayStr,
        mealType: MealType.LUNCH,
        ingredient: 'Rice',
        preparedQuantity: 50,
        consumedQuantity: 46,
        leftoverQuantity: 3.5,
        unaccountedDiff: 0.5,
        unit: AllowedUnit.KG,
        recordedBy: manager._id,
      },
      {
        messId: dummyMessId,
        serviceDate: todayStr,
        mealType: MealType.LUNCH,
        ingredient: 'Dal',
        preparedQuantity: 40,
        consumedQuantity: 37,
        leftoverQuantity: 2.8,
        unaccountedDiff: 0.2,
        unit: AllowedUnit.KG,
        recordedBy: manager._id,
      },
      {
        messId: dummyMessId,
        serviceDate: todayStr,
        mealType: MealType.LUNCH,
        ingredient: 'Paneer',
        preparedQuantity: 35,
        consumedQuantity: 34,
        leftoverQuantity: 0.8,
        unaccountedDiff: 0.2,
        unit: AllowedUnit.KG,
        recordedBy: manager._id,
      },
    ];
    await WasteRecordModel.insertMany(wasteRecords);

    console.log('[Seed] Creating sample feedbacks...');
    await FeedbackModel.insertMany([
      {
        studentId: student1._id,
        menuId: menu._id,
        messId: dummyMessId,
        serviceDate: todayStr,
        mealType: MealType.LUNCH,
        overallRating: 5,
        dishRatings: [
          { dishId: dishes[0]._id, rating: 5 },
          { dishId: dishes[2]._id, rating: 5 },
        ],
        comments: 'Dal Makhani and Paneer were bahut swadist! Best meal this week.',
        isAnonymous: false,
        moderationStatus: ModerationStatus.OK,
        sentiment: {
          label: SentimentLabel.POSITIVE,
          score: 0.85,
          confidence: 0.94,
          status: SentimentStatus.DONE,
          modelVersion: 'v1.0',
        },
        dishesMentioned: ['Dal Makhani', 'Paneer Butter Masala'],
        issues: [],
        isDeleted: false,
      },
      {
        studentId: student2._id,
        menuId: menu._id,
        messId: dummyMessId,
        serviceDate: todayStr,
        mealType: MealType.LUNCH,
        overallRating: 2,
        dishRatings: [{ dishId: dishes[1]._id, rating: 2 }],
        comments: 'Rice was a bit cold today and dal was too salty.',
        isAnonymous: true,
        moderationStatus: ModerationStatus.OK,
        sentiment: {
          label: SentimentLabel.NEGATIVE,
          score: -0.65,
          confidence: 0.88,
          status: SentimentStatus.DONE,
          modelVersion: 'v1.0',
        },
        dishesMentioned: ['Jeera Rice', 'Dal Makhani'],
        issues: [{ type: 'TOO_SALTY', dish: 'Dal Makhani' }, { type: 'COLD_FOOD', dish: 'Jeera Rice' }],
        isDeleted: false,
      },
    ]);

    console.log('[Seed] Creating sample complaint...');
    await ComplaintModel.create({
      studentId: student2._id,
      messId: dummyMessId,
      category: ComplaintCategory.FOOD_HYGIENE,
      priority: ComplaintPriority.MEDIUM,
      status: ComplaintStatus.OPEN,
      title: 'Water dispenser tap loose on Ground Floor',
      description: 'The drinking water dispenser tap leaks and needs maintenance.',
      history: [
        {
          status: ComplaintStatus.OPEN,
          changedBy: student2._id,
          note: 'Complaint registered by student.',
          timestamp: new Date(),
        },
      ],
    });

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

    console.log('\n=============================================================');
    console.log('  MESSINSIGHT DEMO DATABASE SEEDED SUCCESSFULLY!           ');
    console.log('=============================================================');
    console.log('  Login Credentials (all accounts password: Password@123):  ');
    console.log(`  - Admin:   admin@${domain}`);
    console.log(`  - Manager: manager.hostela@${domain}`);
    console.log(`  - Student: aarav.sharma@${domain}`);
    console.log(`  - Student: diya.patel@${domain}`);
    console.log('=============================================================\n');

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
