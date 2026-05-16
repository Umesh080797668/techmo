/**
 * GlitchTip / Sentry error-tracking initialisation for the Customer portal.
 *
 * This file is automatically invoked by Next.js before your application
 * starts.  See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Section 5.2 – Observability  (ENTERPRISE_ECOMMERCE_SYSTEM.md)
 */

export async function register() {
  if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn:               process.env.NEXT_PUBLIC_GLITCHTIP_DSN ?? '',
      tracesSampleRate:  0.2,
      environment:       process.env.NODE_ENV,
      release:           process.env.NEXT_PUBLIC_APP_VERSION ?? 'customer@latest',
      integrations: [
        Sentry.httpIntegration(),
      ],
    });
  }

  if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn:              process.env.NEXT_PUBLIC_GLITCHTIP_DSN ?? '',
      tracesSampleRate: 0.1,
      environment:      process.env.NODE_ENV,
    });
  }
}
