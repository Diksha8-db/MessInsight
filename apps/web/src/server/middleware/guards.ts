import { NextRequest } from 'next/server';
import { UserRepository } from '../repositories/UserRepository';
import { UserRole } from '../models/User';
import { AppError, ErrorCode } from '../lib/errors';
import { verifySessionToken, SessionPayload } from '../lib/auth';
import { env } from '../config/env';

/** Extract and verify the session JWT from the HttpOnly cookie. Validates tokenVersion against DB. */
export async function requireAuth(req: NextRequest): Promise<SessionPayload> {
  const token = req.cookies.get(env.COOKIE_NAME)?.value;
  if (!token) {
    throw AppError.unauthorized('Authentication required. Please log in.', ErrorCode.UNAUTHORIZED);
  }

  // Will throw SESSION_EXPIRED or UNAUTHORIZED for bad/expired tokens
  const session = verifySessionToken(token);

  // Validate tokenVersion against DB to detect logout/role-change invalidation
  const user = await UserRepository.findById(session.sub);
  if (!user) {
    throw AppError.unauthorized('User account not found.', ErrorCode.UNAUTHORIZED);
  }
  if (user.isBlocked) {
    throw AppError.forbidden('Your account has been deactivated.', ErrorCode.ACCOUNT_BLOCKED);
  }
  if (user.tokenVersion !== session.tokenVersion) {
    throw AppError.unauthorized('Session has been invalidated. Please log in again.', ErrorCode.SESSION_EXPIRED);
  }

  return session;
}

/** Require authentication AND one of the specified roles. */
export async function requireRole(
  req: NextRequest,
  ...roles: UserRole[]
): Promise<SessionPayload> {
  const session = await requireAuth(req);
  if (!roles.includes(session.role)) {
    throw AppError.forbidden(
      `Access denied. Required role: ${roles.join(' or ')}.`,
      ErrorCode.FORBIDDEN
    );
  }
  return session;
}

/** Require ADMIN role. */
export async function requireAdmin(req: NextRequest): Promise<SessionPayload> {
  return requireRole(req, UserRole.ADMIN);
}

/** Require MANAGER role. */
export async function requireManager(req: NextRequest): Promise<SessionPayload> {
  return requireRole(req, UserRole.MANAGER, UserRole.ADMIN);
}

/** Require STUDENT role. */
export async function requireStudent(req: NextRequest): Promise<SessionPayload> {
  return requireRole(req, UserRole.STUDENT);
}

/**
 * Enforce that a manager may only act on their assigned mess.
 * Admins bypass this check.
 */
export function requireMessScope(session: SessionPayload, requestedMessId: string): void {
  if (session.role === UserRole.ADMIN) return; // Admins see all
  if (!session.messId || session.messId !== requestedMessId) {
    throw AppError.forbidden(
      'You are not authorized to access this mess.',
      ErrorCode.FORBIDDEN
    );
  }
}

/**
 * Enforce that the requesting user owns the resource.
 * Admins bypass this check.
 */
export function requireOwnership(session: SessionPayload, resourceOwnerId: string): void {
  if (session.role === UserRole.ADMIN) return;
  if (session.sub !== resourceOwnerId) {
    // Return 404 (not 403) to avoid leaking that the resource exists
    throw AppError.notFound('Resource not found.', ErrorCode.NOT_FOUND);
  }
}

/**
 * Reject requests where client tries to supply userId / role / messId in the body.
 * Always derive identity from the session — never trust the client.
 */
export function rejectClientIdentity(body: Record<string, unknown>): void {
  const forbidden = ['userId', 'role', 'messId', 'studentId', 'actorId'];
  const supplied = forbidden.filter((key) => key in body);
  if (supplied.length > 0) {
    throw AppError.badRequest(
      `Client must not supply identity fields: ${supplied.join(', ')}. These are derived from the session.`,
      ErrorCode.BAD_REQUEST
    );
  }
}

