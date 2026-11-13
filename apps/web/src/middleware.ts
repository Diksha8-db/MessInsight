import { NextRequest, NextResponse } from 'next/server';

/** Public routes that do NOT require authentication. */
const PUBLIC_API_ROUTES = new Set([
  '/api/health',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/verify-email',
  '/api/auth/resend-otp',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
]);

/** Pages that do not require authentication. */
const PUBLIC_PAGES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

/** Role → landing page mapping. */
const ROLE_HOME: Record<string, string> = {
  STUDENT: '/student',
  MANAGER: '/manager',
  ADMIN: '/admin',
};

/** State-changing HTTP methods that require CSRF origin check. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // ── CSRF: same-origin check for state-changing API calls ──────────────────
  if (pathname.startsWith('/api/') && MUTATING_METHODS.has(req.method)) {
    if (!PUBLIC_API_ROUTES.has(pathname)) {
      const origin = req.headers.get('origin');
      const host = req.headers.get('host');

      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          // Valid if origin matches current host or configured appUrl
          const isSameOrigin =
            originHost === host ||
            (appUrl && origin.startsWith(appUrl)) ||
            (process.env.VERCEL_URL && originHost.endsWith('.vercel.app'));

          if (!isSameOrigin) {
            return NextResponse.json(
              {
                success: false,
                message: 'Cross-origin request blocked.',
                error: { code: 'FORBIDDEN', correlationId: crypto.randomUUID() },
              },
              { status: 403 }
            );
          }
        } catch {
          // If origin is malformed, reject
          return NextResponse.json(
            {
              success: false,
              message: 'Invalid request origin.',
              error: { code: 'FORBIDDEN', correlationId: crypto.randomUUID() },
            },
            { status: 403 }
          );
        }
      }
    }
  }

  // ── Request size guard (1 MB for JSON API endpoints) ─────────────────────
  if (pathname.startsWith('/api/') && req.method !== 'GET') {
    const contentLength = req.headers.get('content-length');
    const maxBytes = 1 * 1024 * 1024; // 1 MB (uploads have their own endpoint)
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return NextResponse.json(
        {
          success: false,
          message: 'Request payload too large.',
          error: { code: 'PAYLOAD_TOO_LARGE', correlationId: crypto.randomUUID() },
        },
        { status: 413 }
      );
    }
  }

  // ── Page-level route protection ───────────────────────────────────────────
  const isPublicPage = PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublicPage) return NextResponse.next();

  // Protected app pages: /student/*, /manager/*, /admin/*
  const protectedPrefixes = ['/student', '/manager', '/admin'];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Parse session from cookie (lightweight — no DB call in middleware)
  const cookieName = process.env.COOKIE_NAME || 'messinsight_session';
  const token = req.cookies.get(cookieName)?.value;

  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode JWT payload without verifying (verification happens in the API guard).
  // Middleware only checks the role prefix to redirect early.
  try {
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const userRole: string = payload.role;
    const roleHome = ROLE_HOME[userRole] || '/login';

    // Wrong-role guard: /admin/* for a STUDENT → 403
    for (const prefix of protectedPrefixes) {
      if (pathname.startsWith(prefix)) {
        const expectedRole = prefix.slice(1).toUpperCase(); // '/admin' → 'ADMIN'
        if (userRole !== expectedRole) {
          // Redirect to their own home instead of a bare 403 for better UX
          const dest = req.nextUrl.clone();
          dest.pathname = roleHome;
          return NextResponse.redirect(dest);
        }
      }
    }
  } catch {
    // Malformed token — send to login
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply to all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

