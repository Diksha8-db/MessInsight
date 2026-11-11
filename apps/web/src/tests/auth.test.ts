import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import { AuthService } from '../server/services/authService';
import { emailService, devEmailSink } from '../server/services/emailService';
import { UserModel, UserRole } from '../server/models/User';
import { AuditLogModel } from '../server/models/AuditLog';
import { env } from '../server/config/env';
import { verifySessionToken } from '../server/lib/auth';

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
});

describe('Phase 2: Authentication Service & Edge Cases (AUTH-01 to AUTH-24)', () => {
  const validRegistration = {
    name: 'Aarav Sharma',
    instituteEmail: 'aarav.sharma@college.edu',
    password: 'SecurePassword123!',
  };

  it('AUTH-01: registers student successfully with hashed password and forced STUDENT role', async () => {
    // Attempting to pass role: 'ADMIN' in payload
    const result = await AuthService.register(
      { ...validRegistration, role: 'ADMIN' },
      'corr-reg-1'
    );

    expect(result.user.email).toBe(validRegistration.instituteEmail);
    expect(result.user.role).toBe(UserRole.STUDENT); // Forced to STUDENT
    expect(result.user.isVerified).toBe(false);
    expect(result.emailSent).toBe(true);

    // Inspect DB: Password and OTP must NEVER be stored in plaintext
    const dbUser = await UserModel.findOne({ instituteEmail: validRegistration.instituteEmail });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.passwordHash).not.toContain(validRegistration.password);
    expect(dbUser?.passwordHash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash format

    const sentOtp = devEmailSink.getLastOtp(validRegistration.instituteEmail);
    expect(sentOtp).toBeDefined();
    expect(dbUser?.otpHash).not.toBe(sentOtp); // Stored as HMAC hash, never plaintext
  });

  it('AUTH-02: duplicate verified email returns 409 CONFLICT', async () => {
    await AuthService.register(validRegistration, 'corr-reg-2');
    const otp = devEmailSink.getLastOtp(validRegistration.instituteEmail)!;
    await AuthService.verifyEmail({ instituteEmail: validRegistration.instituteEmail, otp }, 'corr-v-2');

    // Attempting duplicate registration
    await expect(
      AuthService.register(validRegistration, 'corr-reg-3')
    ).rejects.toThrow(/already exists/);
  });

  it('AUTH-03: email dispatch failure returns 202 and preserves unverified account', async () => {
    emailService.setSimulateFailure(true);

    const result = await AuthService.register(validRegistration, 'corr-reg-4');
    expect(result.emailSent).toBe(false);
    expect(result.message).toContain('verification email delivery failed');

    // Account exists in DB so student can retry or resend OTP
    const dbUser = await UserModel.findOne({ instituteEmail: validRegistration.instituteEmail });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.isVerified).toBe(false);
  });

  it('AUTH-04 & AUTH-05: verifyEmail rejects expired OTP with 410 and wrong OTP with attempt limit', async () => {
    await AuthService.register(validRegistration, 'corr-reg-5');
    const realOtp = devEmailSink.getLastOtp(validRegistration.instituteEmail)!;

    // Test wrong OTP attempt counter
    await expect(
      AuthService.verifyEmail({ instituteEmail: validRegistration.instituteEmail, otp: '000000' }, 'corr-v-3')
    ).rejects.toThrow(/Invalid OTP.*4 attempts remaining/);

    const dbUser = await UserModel.findOne({ instituteEmail: validRegistration.instituteEmail });
    expect(dbUser?.otpAttempts).toBe(1);

    // Expire OTP manually
    await UserModel.updateOne(
      { instituteEmail: validRegistration.instituteEmail },
      { otpExpiresAt: new Date(Date.now() - 1000) }
    );

    await expect(
      AuthService.verifyEmail({ instituteEmail: validRegistration.instituteEmail, otp: realOtp }, 'corr-v-4')
    ).rejects.toThrow(/expired/);
  });

  it('AUTH-06: OTP is single use; cannot be reused after verification', async () => {
    await AuthService.register(validRegistration, 'corr-reg-6');
    const realOtp = devEmailSink.getLastOtp(validRegistration.instituteEmail)!;

    // Verify first time -> succeeds
    const verified = await AuthService.verifyEmail(
      { instituteEmail: validRegistration.instituteEmail, otp: realOtp },
      'corr-v-5'
    );
    expect(verified.message).toContain('verified successfully');

    // Attempting reuse -> rejects
    await expect(
      AuthService.verifyEmail({ instituteEmail: validRegistration.instituteEmail, otp: realOtp }, 'corr-v-6')
    ).rejects.toThrow();
  });

  it('AUTH-07: resendOtp enforces 60-second cooldown', async () => {
    await AuthService.register(validRegistration, 'corr-reg-7');

    // Immediate resend within 60 seconds throws rate limit
    await expect(
      AuthService.resendOtp({ instituteEmail: validRegistration.instituteEmail })
    ).rejects.toThrow(/wait.*seconds/);
  });

  it('AUTH-08: unverified student login returns 403 EMAIL_NOT_VERIFIED', async () => {
    await AuthService.register(validRegistration, 'corr-reg-8');

    await expect(
      AuthService.login(
        { instituteEmail: validRegistration.instituteEmail, password: validRegistration.password },
        'corr-login-1'
      )
    ).rejects.toThrow(/verify your institute email/);
  });

  it('AUTH-09: wrong password returns generic 401 INVALID_CREDENTIALS', async () => {
    await AuthService.register(validRegistration, 'corr-reg-9');
    const otp = devEmailSink.getLastOtp(validRegistration.instituteEmail)!;
    await AuthService.verifyEmail({ instituteEmail: validRegistration.instituteEmail, otp }, 'corr-v-7');

    await expect(
      AuthService.login(
        { instituteEmail: validRegistration.instituteEmail, password: 'WrongPassword999!' },
        'corr-login-2'
      )
    ).rejects.toThrow(/Invalid email or password/);
  });

  it('AUTH-10: 5 consecutive failed login attempts locks account for 15 minutes with 429', async () => {
    await AuthService.register(validRegistration, 'corr-reg-10');
    const otp = devEmailSink.getLastOtp(validRegistration.instituteEmail)!;
    await AuthService.verifyEmail({ instituteEmail: validRegistration.instituteEmail, otp }, 'corr-v-8');

    // 4 wrong passwords
    for (let i = 0; i < 4; i++) {
      await expect(
        AuthService.login(
          { instituteEmail: validRegistration.instituteEmail, password: 'WrongPassword!' },
          'corr-login-fail'
        )
      ).rejects.toThrow(/Invalid email or password/);
    }

    // 5th failed attempt triggers 15-minute lockout (429)
    await expect(
      AuthService.login(
        { instituteEmail: validRegistration.instituteEmail, password: 'WrongPassword!' },
        'corr-login-fail-5'
      )
    ).rejects.toThrow(/temporarily locked/);

    const dbUser = await UserModel.findOne({ instituteEmail: validRegistration.instituteEmail });
    expect(dbUser?.lockoutUntil).not.toBeNull();
    expect(new Date(dbUser!.lockoutUntil!).getTime()).toBeGreaterThan(Date.now());
  });

  it('AUTH-11: blocked account login returns 403 ACCOUNT_BLOCKED', async () => {
    await AuthService.register(validRegistration, 'corr-reg-11');
    const otp = devEmailSink.getLastOtp(validRegistration.instituteEmail)!;
    await AuthService.verifyEmail({ instituteEmail: validRegistration.instituteEmail, otp }, 'corr-v-9');

    // Admin blocks account
    await UserModel.updateOne({ instituteEmail: validRegistration.instituteEmail }, { isBlocked: true });

    await expect(
      AuthService.login(
        { instituteEmail: validRegistration.instituteEmail, password: validRegistration.password },
        'corr-login-blocked'
      )
    ).rejects.toThrow(/account has been deactivated/);
  });

  it('AUTH-12: successful login returns valid JWT session with tokenVersion', async () => {
    await AuthService.register(validRegistration, 'corr-reg-12');
    const otp = devEmailSink.getLastOtp(validRegistration.instituteEmail)!;
    await AuthService.verifyEmail({ instituteEmail: validRegistration.instituteEmail, otp }, 'corr-v-10');

    const session = await AuthService.login(
      { instituteEmail: validRegistration.instituteEmail, password: validRegistration.password },
      'corr-login-success'
    );

    expect(session.user.email).toBe(validRegistration.instituteEmail);
    expect(session.token).toBeDefined();

    const decoded = verifySessionToken(session.token);
    expect(decoded.sub).toBe(session.user.id);
    expect(decoded.email).toBe(session.user.email);
    expect(decoded.tokenVersion).toBe(0);
  });

  it('AUTH-13: logout invalidates session server-side via tokenVersion bump', async () => {
    await AuthService.register(validRegistration, 'corr-reg-13');
    const otp = devEmailSink.getLastOtp(validRegistration.instituteEmail)!;
    await AuthService.verifyEmail({ instituteEmail: validRegistration.instituteEmail, otp }, 'corr-v-11');

    const session = await AuthService.login(
      { instituteEmail: validRegistration.instituteEmail, password: validRegistration.password },
      'corr-login-13'
    );

    // Logout
    await AuthService.logout(session.user.id);

    // GET /me checks tokenVersion: tokenVersion in token (0) no longer matches DB (1)
    const dbUser = await UserModel.findById(session.user.id);
    expect(dbUser?.tokenVersion).toBe(1);
  });

  it('AUTH-14: reject tampered JWT and alg=none attack', () => {
    // Create an unsigned alg=none attack token
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'admin-id', role: 'ADMIN' })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    expect(() => verifySessionToken(noneToken)).toThrow();

    // Tampered token signature
    const validToken = jwt.sign({ sub: 'test-id' }, env.JWT_SECRET, { algorithm: 'HS256' });
    const tampered = validToken.slice(0, -5) + 'xxxxx';

    expect(() => verifySessionToken(tampered)).toThrow();
  });

  it('AUTH-15: forgot-password returns uniform message for existing and non-existing email', async () => {
    const resUnknown = await AuthService.forgotPassword(
      { instituteEmail: 'unknown.ghost@college.edu' },
      'corr-fp-1'
    );
    expect(resUnknown.message).toContain('If this email is registered');

    await AuthService.register(validRegistration, 'corr-reg-15');
    const resKnown = await AuthService.forgotPassword(
      { instituteEmail: validRegistration.instituteEmail },
      'corr-fp-2'
    );
    expect(resKnown.message).toBe(resUnknown.message);
  });

  it('AUTH-16: change-password rejects same password and revokes other sessions', async () => {
    await AuthService.register(validRegistration, 'corr-reg-16');
    const otp = devEmailSink.getLastOtp(validRegistration.instituteEmail)!;
    await AuthService.verifyEmail({ instituteEmail: validRegistration.instituteEmail, otp }, 'corr-v-16');

    const session = await AuthService.login(
      { instituteEmail: validRegistration.instituteEmail, password: validRegistration.password },
      'corr-login-16'
    );

    // Same password rejected
    await expect(
      AuthService.changePassword(
        session.user.id,
        { currentPassword: validRegistration.password, newPassword: validRegistration.password },
        'corr-cp-1'
      )
    ).rejects.toThrow(/same as your current password/);

    // Wrong current password rejected
    await expect(
      AuthService.changePassword(
        session.user.id,
        { currentPassword: 'WrongPassword!', newPassword: 'BrandNewPassword123#' },
        'corr-cp-2'
      )
    ).rejects.toThrow(/Current password is incorrect/);

    // Valid change bumps tokenVersion
    await AuthService.changePassword(
      session.user.id,
      { currentPassword: validRegistration.password, newPassword: 'BrandNewPassword123#' },
      'corr-cp-3'
    );

    const dbUser = await UserModel.findById(session.user.id);
    expect(dbUser?.tokenVersion).toBe(1);
  });
});
