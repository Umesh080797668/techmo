import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS      = ['/login'];
const SEMI_PUBLIC_PATHS = ['/force-change-password'];

/** Security response headers applied to EVERY admin response. */
function applySecurityHeaders(response: NextResponse): NextResponse {
  // Prevent the admin dashboard from being embedded in iframes (clickjacking).
  response.headers.set('X-Frame-Options', 'DENY');

  // Block MIME-type sniffing attacks.
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Don't send the full Referrer URL to external sites.
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Force HTTPS for 1 year (browser caches this; also covers subdomains).
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload',
  );

  // Only allow geolocation / camera / mic if the admin explicitly needs them.
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()',
  );

  // Content-Security-Policy:
  //   - default-src 'self'  : Only load content from the same origin.
  //   - script-src + style-src 'unsafe-inline': Required by Next.js SSR.
  //   - img-src: allow Cloudinary CDN images and data URIs.
  //   - connect-src: allow API gateway and WebSocket (HMR in dev).
  //   - frame-ancestors 'none': double-locks the iframe block above.
  const gatewayOrigin = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000';
  response.headers.set(
    'Content-Security-Policy',
    [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `img-src 'self' data: blob: https://res.cloudinary.com`,
      `connect-src 'self' ${gatewayOrigin} ws: wss:`,
      `font-src 'self' data: https://fonts.gstatic.com`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `frame-ancestors 'none'`,
    ].join('; '),
  );

  // Remove the Next.js powered-by header so the tech stack isn't disclosed.
  response.headers.delete('X-Powered-By');

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and Next.js internals
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    SEMI_PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon')
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Check for auth token in cookie (set client-side by login page)
  const token = request.cookies.get('techmo_token')?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
