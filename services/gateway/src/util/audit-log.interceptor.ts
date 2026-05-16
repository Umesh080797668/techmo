import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap }        from 'rxjs/operators';
import { Request }    from 'express';
import { maskObject } from '../util/pii-mask';

/**
 * Audit Log Interceptor with PII Masking
 * ========================================
 * Intercepts every inbound HTTP request on the gateway and writes a structured
 * audit log entry to Loki (via the Pino/Winston logger) with any PII values
 * automatically masked.
 *
 * Sample log line (JSON):
 * {
 *   "ts":       "2025-01-15T07:22:33.000Z",
 *   "level":    "audit",
 *   "userId":   "usr_01J…",
 *   "role":     "MANAGER",
 *   "action":   "PATCH /api/v1/repairs/123",
 *   "ip":       "::ffff:10.0.0.5",
 *   "payload":  { "phone": "+94771****567", "notes": "Customer sam***@gmail.com called" },
 *   "status":   200,
 *   "latencyMs": 47
 * }
 *
 * Sensitive routes bypass body logging:
 *   - /auth/login, /auth/refresh, /auth/webauthn/**
 *
 * Registering:
 *   In app.module.ts → { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor }
 */

const BODY_SKIP_PATHS = ['/auth/login', '/auth/refresh', '/auth/webauthn', '/auth/passkey'];

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AUDIT');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req     = context.switchToHttp().getRequest<Request>();
    const start   = Date.now();
    const user    = (req as Request & { user?: { sub?: string; role?: string } }).user;

    return next.handle().pipe(
      tap({
        next: (data) => {
          const res    = context.switchToHttp().getResponse<{ statusCode: number }>();
          const status = res.statusCode;

          const skipBody = BODY_SKIP_PATHS.some((p) => req.path.startsWith(p));
          const payload  = skipBody ? '[REDACTED]' : maskObject(req.body);

          this.logger.log(
            JSON.stringify({
              ts:        new Date().toISOString(),
              level:     'audit',
              userId:    user?.sub   ?? 'anonymous',
              role:      user?.role  ?? 'unknown',
              action:    `${req.method} ${req.path}`,
              ip:        req.ip,
              payload,
              status,
              latencyMs: Date.now() - start,
            }),
          );

          // Suppress unused data warning
          void data;
        },
        error: (err) => {
          this.logger.warn(
            JSON.stringify({
              ts:        new Date().toISOString(),
              level:     'audit-error',
              userId:    user?.sub  ?? 'anonymous',
              action:    `${req.method} ${req.path}`,
              ip:        req.ip,
              error:     (err as Error).message,
              latencyMs: Date.now() - start,
            }),
          );
        },
      }),
    );
  }
}
