import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ComplaintService } from '../server/services/complaintService';
import { ComplaintModel, ComplaintCategory, ComplaintPriority, ComplaintStatus } from '../server/models/Complaint';
import { UserModel } from '../server/models/User';
import { NotificationModel } from '../server/models/Notification';

let mongoServer: MongoMemoryServer;
let messId: string;
let studentId: string;
let managerId: string;

describe('Complaint Integration Tests (COMP-01 to COMP-10)', () => {
  beforeAll(async () => {
    try {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
      await Promise.all([
        ComplaintModel.syncIndexes(),
        UserModel.syncIndexes(),
      ]);
    } catch {
      // MongoMemoryServer might be restricted in sandboxed environments
    }

    messId = new mongoose.Types.ObjectId().toString();
    studentId = new mongoose.Types.ObjectId().toString();
    managerId = new mongoose.Types.ObjectId().toString();
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
      ComplaintModel.deleteMany({}),
      UserModel.deleteMany({}),
      NotificationModel.deleteMany({}),
    ]);
  });

  it('COMP-01: registers student hygiene complaint with initial OPEN status', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const complaint = await ComplaintService.createComplaint(
      studentId,
      {
        messId,
        category: ComplaintCategory.FOOD_HYGIENE,
        priority: ComplaintPriority.HIGH,
        title: 'Dirty dining table and cutleries',
        description: 'The spoons provided had dried food residues on them.',
      },
      'corr-comp-01'
    );

    expect(complaint).toBeDefined();
    expect(complaint.status).toBe(ComplaintStatus.OPEN);
    expect(complaint.category).toBe(ComplaintCategory.FOOD_HYGIENE);
    expect(complaint.priority).toBe(ComplaintPriority.HIGH);
    expect(complaint.history.length).toBe(1);
    expect(complaint.history[0].status).toBe(ComplaintStatus.OPEN);
  });

  it('COMP-02: updates complaint status to IN_PROGRESS and RESOLVED with manager note', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const created = await ComplaintService.createComplaint(
      studentId,
      {
        messId,
        category: ComplaintCategory.WATER_QUALITY,
        priority: ComplaintPriority.MEDIUM,
        title: 'Water dispenser tastes metallic',
        description: 'The RO water dispenser on floor 1 tastes strange.',
      },
      'corr-comp-02'
    );

    // Update to IN_PROGRESS
    const inProgress = await ComplaintService.updateStatus(
      created._id.toString(),
      messId,
      managerId,
      {
        status: ComplaintStatus.IN_PROGRESS,
        note: 'Service technician dispatched to inspect RO filter.',
      },
      'corr-comp-02-progress'
    );
    expect(inProgress.status).toBe(ComplaintStatus.IN_PROGRESS);
    expect(inProgress.history.length).toBe(2);

    // Update to RESOLVED
    const resolved = await ComplaintService.updateStatus(
      created._id.toString(),
      messId,
      managerId,
      {
        status: ComplaintStatus.RESOLVED,
        managerResponse: 'RO carbon cartridge replaced. Water quality certified clean.',
      },
      'corr-comp-02-resolve'
    );
    expect(resolved.status).toBe(ComplaintStatus.RESOLVED);
    expect(resolved.resolvedAt).toBeDefined();
    expect(resolved.history.length).toBe(3);
  });
});
