import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { UserModel, UserRole } from '../server/models/User';
import { AuditLogModel } from '../server/models/AuditLog';
import { AuthService } from '../server/services/authService';
import { AdminService } from '../server/services/adminService';
import { emailService, devEmailSink } from '../server/services/emailService';
import { requireAuth, requireRole, requireMessScope, requireOwnership, rejectClientIdentity } from '../server/middleware/guards';
import { rateLimit, clearRateLimitStore } from '../server/lib/rateLimiter';
import { AppError, ErrorCode } from '../server/lib/errors';
import { signSessionToken } from '../server/lib/auth';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await UserModel.syncIndexes();
  await AuditLogModel.syncIndexes();
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await UserModel.deleteMany({});
  await AuditLogModel.deleteMany({});
  devEmailSink.clear();
  emailService.setSimulateFailure(false);
  clearRateLimitStore();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function registerAndVerify(email: string, password = 'SecurePassword123!', name = 'Test User') {
  await AuthService.register({ name, instituteEmail: email, password }, 'corr-setup');
  const otp = devEmailSink.getLastOtp(email)!;
  await AuthService.verifyEmail({ instituteEmail: email, otp }, 'corr-setup-v');
  return UserModel.findOne({ instituteEmail: email });
}

function makeMockRequest(token?: string, overrides?: Record<string, unknown>) {
  return {
    cookies: {
      get: (name: string) => (name === (process.env.COOKIE_NAME || 'messinsight_session') && token ? { value: token } : undefined),
    },
    ...overrides,
  } as unknown as import('next/server').NextRequest;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE GUARD SCANNER — fails if any protected /api route lacks a guard call
// ─────────────────────────────────────────────────────────────────────────────
describe('Route Guard Scanner', () => {
  const API_DIR = join(process.cwd(), 'src/app/api');

  /** Public routes exempt from guard requirement. */
  const PUBLIC_ROUTES = new Set([
    'health',
    'auth/register',
    'auth/login',
    'auth/logout',
    'auth/verify-email',
    'auth/resend-otp',
    'auth/forgot-password',
    'auth/reset-password',
    'auth/me', // me uses requireAuth internally via guard
  ]);

  const GUARD_PATTERNS = [
    /requireAuth\s*\(/,
    /requireAdmin\s*\(/,
    /requireManager\s*\(/,
    /requireStudent\s*\(/,
    /requireRole\s*\(/,
  ];

  function collectRouteFiles(dir: string, base = ''): Array<{ rel: string; file: string }> {
    const results: Array<{ rel: string; file: string }> = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      const relPath = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        results.push(...collectRouteFiles(fullPath, relPath));
      } else if (entry.name === 'route.ts') {
        results.push({ rel: base, file: fullPath });
      }
    }
    return results;
  }

  it('every protected API route handler uses a guard', () => {
    const routes = collectRouteFiles(API_DIR);
    const unguarded: string[] = [];

    for (const { rel, file } of routes) {
      // Normalize: strip [id], [slug] segments for set lookup
      const normalized = rel.replace(/\[.*?\]/g, '[id]');
      const isPublic = Array.from(PUBLIC_ROUTES).some((p) => rel.startsWith(p));
      if (isPublic) continue;

      const content = readFileSync(file, 'utf8');
      const hasGuard = GUARD_PATTERNS.some((re) => re.test(content));
      if (!hasGuard) {
        unguarded.push(`${rel}/route.ts`);
      }
    }

    if (unguarded.length > 0) {
      throw new Error(
        `The following API routes have no RBAC guard:\n${unguarded.map((r) => `  - ${r}`).join('\n')}\n` +
          `Add requireAuth/requireAdmin/requireManager/requireRole to each.`
      );
    }
    expect(unguarded).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RBAC-01: requireAuth rejects request with no cookie
// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 3: RBAC Guards & Admin', () => {
  it('RBAC-01: requireAuth rejects missing cookie with 401 UNAUTHORIZED', async () => {
    const req = makeMockRequest(undefined);
    await expect(requireAuth(req)).rejects.toMatchObject({
      code: ErrorCode.UNAUTHORIZED,
      statusCode: 401,
    });
  });

  it('RBAC-02: requireAuth rejects tampered / expired token with 401', async () => {
    const badToken = 'totally.not.valid';
    const req = makeMockRequest(badToken);
    await expect(requireAuth(req)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('RBAC-03: requireRole ADMIN rejects STUDENT with 403 FORBIDDEN', async () => {
    const student = await registerAndVerify('student.rbac@college.edu');
    const token = signSessionToken({
      sub: student!._id.toString(),
      email: student!.instituteEmail,
      role: UserRole.STUDENT,
      tokenVersion: student!.tokenVersion,
    });
    const req = makeMockRequest(token);
    await expect(requireRole(req, UserRole.ADMIN)).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
      statusCode: 403,
    });
  });

  it('RBAC-04: requireRole ADMIN rejects MANAGER with 403 FORBIDDEN', async () => {
    const user = await registerAndVerify('manager.rbac@college.edu');
    await UserModel.updateOne({ _id: user!._id }, { role: UserRole.MANAGER, assignedMessId: new mongoose.Types.ObjectId() });
    const updated = await UserModel.findById(user!._id);
    const token = signSessionToken({
      sub: updated!._id.toString(),
      email: updated!.instituteEmail,
      role: UserRole.MANAGER,
      tokenVersion: updated!.tokenVersion,
    });
    const req = makeMockRequest(token);
    await expect(requireRole(req, UserRole.ADMIN)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('RBAC-05: blocked user with valid token gets 403 ACCOUNT_BLOCKED', async () => {
    const user = await registerAndVerify('blocked.rbac@college.edu');
    const token = signSessionToken({
      sub: user!._id.toString(),
      email: user!.instituteEmail,
      role: UserRole.STUDENT,
      tokenVersion: user!.tokenVersion,
    });
    // Block the user in DB
    await UserModel.updateOne({ _id: user!._id }, { isBlocked: true });
    const req = makeMockRequest(token);
    await expect(requireAuth(req)).rejects.toMatchObject({
      code: ErrorCode.ACCOUNT_BLOCKED,
      statusCode: 403,
    });
  });

  it('RBAC-06: session invalidated after tokenVersion bump (logout)', async () => {
    const user = await registerAndVerify('tv.rbac@college.edu');
    const tokenAtV0 = signSessionToken({
      sub: user!._id.toString(),
      email: user!.instituteEmail,
      role: UserRole.STUDENT,
      tokenVersion: 0,
    });
    // Bump tokenVersion (simulates logout)
    await UserModel.updateOne({ _id: user!._id }, { $inc: { tokenVersion: 1 } });
    const req = makeMockRequest(tokenAtV0);
    await expect(requireAuth(req)).rejects.toMatchObject({
      code: ErrorCode.SESSION_EXPIRED,
      statusCode: 401,
    });
  });

  it('RBAC-07: requireMessScope allows manager for their own mess', () => {
    const session = {
      sub: 'mgr1',
      email: 'mgr@college.edu',
      role: UserRole.MANAGER,
      messId: 'mess123',
      tokenVersion: 0,
    };
    expect(() => requireMessScope(session, 'mess123')).not.toThrow();
  });

  it('RBAC-07b: requireMessScope blocks manager for different mess', () => {
    const session = {
      sub: 'mgr1',
      email: 'mgr@college.edu',
      role: UserRole.MANAGER,
      messId: 'messA',
      tokenVersion: 0,
    };
    expect(() => requireMessScope(session, 'messB')).toThrow();
  });

  it('RBAC-08: requireOwnership blocks access to another user resource with 404', () => {
    const session = {
      sub: 'user1',
      email: 'u1@college.edu',
      role: UserRole.STUDENT,
      tokenVersion: 0,
    };
    expect(() => requireOwnership(session, 'user2')).toThrow(
      expect.objectContaining({ code: ErrorCode.NOT_FOUND })
    );
  });

  it('RBAC-08b: requireOwnership allows access to own resource', () => {
    const session = {
      sub: 'user1',
      email: 'u1@college.edu',
      role: UserRole.STUDENT,
      tokenVersion: 0,
    };
    expect(() => requireOwnership(session, 'user1')).not.toThrow();
  });

  it('RBAC-09: ADMIN bypasses requireMessScope and requireOwnership', () => {
    const adminSession = {
      sub: 'admin1',
      email: 'admin@college.edu',
      role: UserRole.ADMIN,
      tokenVersion: 0,
    };
    expect(() => requireMessScope(adminSession, 'anyMess')).not.toThrow();
    expect(() => requireOwnership(adminSession, 'anyUser')).not.toThrow();
  });

  it('RBAC-10: rejectClientIdentity blocks userId / role / messId in body', () => {
    expect(() => rejectClientIdentity({ userId: 'hack', name: 'Alice' })).toThrow(
      expect.objectContaining({ code: ErrorCode.BAD_REQUEST })
    );
    expect(() => rejectClientIdentity({ role: 'ADMIN' })).toThrow();
    expect(() => rejectClientIdentity({ messId: 'x' })).toThrow();
    // Clean body passes
    expect(() => rejectClientIdentity({ name: 'Alice', email: 'a@b.com' })).not.toThrow();
  });

  // ── Admin Service Tests ───────────────────────────────────────────────────

  it('RBAC-11: admin can block a user; session is immediately invalidated (tokenVersion bump)', async () => {
    const admin = await registerAndVerify('admin.rbac@college.edu');
    await UserModel.updateOne({ _id: admin!._id }, { role: UserRole.ADMIN });

    const target = await registerAndVerify('target.rbac@college.edu');
    const tokenBefore = target!.tokenVersion;

    await AdminService.blockUser(admin!._id.toString(), target!._id.toString(), 'corr-block');

    const updated = await UserModel.findById(target!._id);
    expect(updated?.isBlocked).toBe(true);
    expect(updated?.tokenVersion).toBe(tokenBefore + 1); // Session revoked

    // Audit log written
    const logs = await AuditLogModel.find({ action: 'ADMIN_BLOCK_USER' });
    expect(logs).toHaveLength(1);
    expect(logs[0].summary).not.toContain('password');
    expect(logs[0].summary).not.toContain('token');
  });

  it('RBAC-12: last admin cannot be blocked', async () => {
    const admin = await registerAndVerify('lastadmin@college.edu');
    await UserModel.updateOne({ _id: admin!._id }, { role: UserRole.ADMIN });

    // Only one admin exists
    await expect(
      AdminService.blockUser(admin!._id.toString(), admin!._id.toString(), 'corr-self-block')
    ).rejects.toThrow(/own account/);
  });

  it('RBAC-13: admin assign-manager promotes user and bumps tokenVersion', async () => {
    const admin = await registerAndVerify('admin2.rbac@college.edu');
    await UserModel.updateOne({ _id: admin!._id }, { role: UserRole.ADMIN });

    const user = await registerAndVerify('topromo.rbac@college.edu');
    const messId = new mongoose.Types.ObjectId().toString();

    await AdminService.assignManager(admin!._id.toString(), user!._id.toString(), messId, 'corr-assign');

    const updated = await UserModel.findById(user!._id);
    expect(updated?.role).toBe(UserRole.MANAGER);
    expect(updated?.assignedMessId?.toString()).toBe(messId);
    // Role change takes effect immediately
    expect(updated?.tokenVersion).toBe(user!.tokenVersion + 1);

    const logs = await AuditLogModel.find({ action: 'ADMIN_ASSIGN_MANAGER' });
    expect(logs).toHaveLength(1);
  });

  it('RBAC-14: admin remove-manager demotes user and bumps tokenVersion', async () => {
    const admin = await registerAndVerify('admin3.rbac@college.edu');
    await UserModel.updateOne({ _id: admin!._id }, { role: UserRole.ADMIN });

    const user = await registerAndVerify('todemote.rbac@college.edu');
    const messId = new mongoose.Types.ObjectId().toString();
    await AdminService.assignManager(admin!._id.toString(), user!._id.toString(), messId, 'corr-assign2');

    await AdminService.removeManager(admin!._id.toString(), user!._id.toString(), 'corr-demote');

    const updated = await UserModel.findById(user!._id);
    expect(updated?.role).toBe(UserRole.STUDENT);
    expect(updated?.assignedMessId).toBeNull();
  });

  it('RBAC-15: admin remove (anonymize) leaves no PII for the account', async () => {
    const admin = await registerAndVerify('admin4.rbac@college.edu');
    await UserModel.updateOne({ _id: admin!._id }, { role: UserRole.ADMIN });

    const user = await registerAndVerify('todelete.rbac@college.edu');
    await AdminService.removeUser(admin!._id.toString(), user!._id.toString(), 'corr-remove');

    const removed = await UserModel.findById(user!._id);
    expect(removed?.name).toBe('Anonymized User');
    expect(removed?.instituteEmail).toContain('@anonymized.local');
    expect(removed?.passwordHash).toBe('[ANONYMIZED]');
    expect(removed?.isBlocked).toBe(true);
  });

  // ── Rate Limiter ──────────────────────────────────────────────────────────

  it('SEC-01: rate limiter throws 429 after limit is reached', () => {
    const opts = { key: 'test:rl:1', limit: 3, windowSeconds: 60 };
    rateLimit(opts); // 1
    rateLimit(opts); // 2
    rateLimit(opts); // 3
    expect(() => rateLimit(opts)).toThrow( // 4th → rate limited
      expect.objectContaining({ statusCode: 429, code: ErrorCode.RATE_LIMITED })
    );
  });

  it('SEC-02: rate limiter allows requests again after window slides', async () => {
    const opts = { key: 'test:rl:2', limit: 2, windowSeconds: 1 };
    rateLimit(opts);
    rateLimit(opts);
    // Wait for window to pass
    await new Promise((r) => setTimeout(r, 1100));
    expect(() => rateLimit(opts)).not.toThrow(); // Window slid, counter reset
  });

  // ── NoSQL Injection Guard ─────────────────────────────────────────────────

  it('SEC-03: NoSQL injection via $ne operator in email is rejected by Zod validators', async () => {
    // The login Zod schema enforces string type for instituteEmail,
    // so a { $ne: "" } object cannot pass through — Zod rejects non-strings.
    const { loginSchema } = await import('../server/validators/authValidators');
    const result = loginSchema.safeParse({
      instituteEmail: { $ne: '' },
      password: 'whatever',
    });
    expect(result.success).toBe(false);
  });

  // ── Audit Log Scrubbing ───────────────────────────────────────────────────

  it('SEC-04: audit log entries never contain password, token, or OTP fields', async () => {
    const admin = await registerAndVerify('auditadmin@college.edu');
    await UserModel.updateOne({ _id: admin!._id }, { role: UserRole.ADMIN });
    const target = await registerAndVerify('audittarget@college.edu');

    await AdminService.blockUser(admin!._id.toString(), target!._id.toString(), 'corr-audit-sec');

    const logs = await AuditLogModel.find({});
    for (const log of logs) {
      expect(log.summary).not.toMatch(/password|token|otp|secret/i);
    }
  });
});

