import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../models/User';
import { AppError, ErrorCode } from './errors';

export interface SessionPayload {
  sub: string;
  email: string;
  role: UserRole;
  messId?: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateOtp(): string {
  // Generates cryptographically secure 6-digit integer
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

export function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', env.JWT_SECRET).update(otp).digest('hex');
}

export function verifyOtpHash(inputOtp: string, storedHash: string): boolean {
  try {
    const inputHash = hashOtp(inputOtp);
    const a = Buffer.from(inputHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifySessionToken(token: string): SessionPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'], // Strictly pinned algorithm to prevent alg:none or downgrade attacks
    }) as SessionPayload;

    return decoded;
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Session has expired. Please log in again.', ErrorCode.SESSION_EXPIRED);
    }
    throw AppError.unauthorized('Invalid authentication session.', ErrorCode.UNAUTHORIZED);
  }
}

export function getSessionCookieOptions(maxAgeSeconds = 7 * 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

