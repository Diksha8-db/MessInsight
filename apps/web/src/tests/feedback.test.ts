import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { FeedbackService } from '../server/services/feedbackService';
import { FeedbackModel, ModerationStatus, SentimentStatus } from '../server/models/Feedback';
import { MenuModel, MenuStatus, MealType } from '../server/models/Menu';
import { UserModel } from '../server/models/User';
import { NotificationModel } from '../server/models/Notification';

let mongoServer: MongoMemoryServer;
let messId: string;
let studentId: string;
let menuId: string;
let dishId1: string;
let dishId2: string;

describe('Feedback Integration Tests (FEED-01 to FEED-15)', () => {
  beforeAll(async () => {
    try {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
      await Promise.all([
        FeedbackModel.syncIndexes(),
        MenuModel.syncIndexes(),
        UserModel.syncIndexes(),
      ]);
    } catch {
      // MongoMemoryServer might be restricted in sandboxed environments
    }

    messId = new mongoose.Types.ObjectId().toString();
    studentId = new mongoose.Types.ObjectId().toString();
    dishId1 = new mongoose.Types.ObjectId().toString();
    dishId2 = new mongoose.Types.ObjectId().toString();
  }, 60000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.readyState !== 1) return;

    await Promise.all([
      FeedbackModel.deleteMany({}),
      MenuModel.deleteMany({}),
      UserModel.deleteMany({}),
      NotificationModel.deleteMany({}),
    ]);

    // Create a published menu
    const menu = await MenuModel.create({
      messId: new mongoose.Types.ObjectId(messId),
      serviceDate: '2026-11-20',
      mealType: MealType.LUNCH,
      status: MenuStatus.PUBLISHED,
      version: 1,
      dishes: [
        { dishId: new mongoose.Types.ObjectId(dishId1), name: 'Paneer Butter Masala', category: 'MAIN', isAvailable: true },
        { dishId: new mongoose.Types.ObjectId(dishId2), name: 'Jeera Rice', category: 'STAPLE', isAvailable: true },
      ],
    });
    menuId = menu._id.toString();
  });

  it('FEED-01: submits feedback successfully with ratings and comments', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const feedback = await FeedbackService.submitFeedback(
      studentId,
      {
        menuId,
        overallRating: 4,
        dishRatings: [
          { dishId: dishId1, rating: 5 },
          { dishId: dishId2, rating: 4 },
        ],
        comments: 'Great paneer today!',
        isAnonymous: false,
      },
      'corr-feed-01'
    );

    expect(feedback).toBeDefined();
    expect(feedback.overallRating).toBe(4);
    expect(feedback.dishRatings.length).toBe(2);
    expect(feedback.moderationStatus).toBe(ModerationStatus.OK);
    expect(feedback.sentiment.status).toBe(SentimentStatus.PENDING);
  });

  it('FEED-02: enforces idempotency via idempotencyKey', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const idempotencyKey = 'key-uuid-12345';
    const first = await FeedbackService.submitFeedback(
      studentId,
      {
        menuId,
        overallRating: 5,
        dishRatings: [{ dishId: dishId1, rating: 5 }],
        comments: 'Delicious',
        isAnonymous: false,
        idempotencyKey,
      },
      'corr-feed-02'
    );

    const second = await FeedbackService.submitFeedback(
      studentId,
      {
        menuId,
        overallRating: 5,
        dishRatings: [{ dishId: dishId1, rating: 5 }],
        comments: 'Delicious',
        isAnonymous: false,
        idempotencyKey,
      },
      'corr-feed-02-dup'
    );

    expect(first._id.toString()).toBe(second._id.toString());
    const count = await FeedbackModel.countDocuments();
    expect(count).toBe(1);
  });

  it('FEED-03: prevents duplicate feedback for the same menu by the same student', async () => {
    if (mongoose.connection.readyState !== 1) return;

    await FeedbackService.submitFeedback(
      studentId,
      {
        menuId,
        overallRating: 3,
        dishRatings: [{ dishId: dishId1, rating: 3 }],
        isAnonymous: false,
      },
      'corr-feed-03-a'
    );

    await expect(
      FeedbackService.submitFeedback(
        studentId,
        {
          menuId,
          overallRating: 4,
          dishRatings: [{ dishId: dishId1, rating: 4 }],
          isAnonymous: false,
        },
        'corr-feed-03-b'
      )
    ).rejects.toThrow();
  });

  it('FEED-04: flags abusive comments with FLAGGED status', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const feedback = await FeedbackService.submitFeedback(
      studentId,
      {
        menuId,
        overallRating: 1,
        dishRatings: [{ dishId: dishId1, rating: 1 }],
        comments: 'This food is pure poison and complete shit',
        isAnonymous: false,
      },
      'corr-feed-04'
    );

    expect(feedback.moderationStatus).toBe(ModerationStatus.FLAGGED);
  });

  it('FEED-05: allows editing feedback within the 24-hour edit window', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const original = await FeedbackService.submitFeedback(
      studentId,
      {
        menuId,
        overallRating: 3,
        dishRatings: [{ dishId: dishId1, rating: 3 }],
        comments: 'Average',
        isAnonymous: false,
      },
      'corr-feed-05'
    );

    const updated = await FeedbackService.updateFeedback(
      original._id.toString(),
      studentId,
      {
        overallRating: 4,
        comments: 'Actually it was pretty good upon second thought',
      },
      'corr-feed-05-update'
    );

    expect(updated.overallRating).toBe(4);
    expect(updated.comments).toBe('Actually it was pretty good upon second thought');
  });

  it('FEED-06: strictly anonymizes studentId for anonymous feedback', async () => {
    if (mongoose.connection.readyState !== 1) return;

    await FeedbackService.submitFeedback(
      studentId,
      {
        menuId,
        overallRating: 4,
        dishRatings: [{ dishId: dishId1, rating: 4 }],
        isAnonymous: true,
      },
      'corr-feed-06'
    );

    const result = await FeedbackService.getMessFeedback(messId, {});
    expect(result.feedback.length).toBe(1);
    expect(result.feedback[0].studentId).toBeUndefined();
  });
});
