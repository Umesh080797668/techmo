/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },

  // ── Security headers applied to every customer-portal response ──────────────
  async headers() {
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3000';

    const ContentSecurityPolicy = [
      "default-src 'self'",
      // Next.js requires unsafe-eval in dev; tighten in production if possible
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Allow Cloudinary images + data URIs for inline previews
      "img-src 'self' data: blob: https://res.cloudinary.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Gateway API + same origin — update if you add a CDN or analytics
      `connect-src 'self' ${gatewayUrl} https://api.techmo.lk`,
      // No iframes allowed
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking — redundant with frame-ancestors CSP but
          // kept for older browsers that don't honour CSP.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Stop browsers from MIME-sniffing responses away from declared type.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Only send the origin (no path) as the Referer on cross-origin links.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Disable browser features the portal doesn't need.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Enforce HTTPS for 1 year (browser-side HSTS).
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
        ],
      },
    ];
  },

  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
