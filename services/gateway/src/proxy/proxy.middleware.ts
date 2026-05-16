import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, fixRequestBody, Options } from 'http-proxy-middleware';
import type { ClientRequest, IncomingMessage } from 'http';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  // Instance-level env key — set once per DynamicProxy class via the
  // for() factory. Avoids the shared-static race condition where all
  // proxy instances overwrote a single static field.
  protected readonly _envKey: string = '';

  static for(envKey: string, pathRewrite: string): any {
    return class DynamicProxy extends ProxyMiddleware {
      protected override readonly _envKey = envKey;
    };
  }

  use(req: Request, res: Response, next: NextFunction) {
    const target = process.env[this._envKey];
    if (!target) {
      res.status(502).json({ message: `Service ${this._envKey} not configured` });
      return;
    }

    const proxyOptions: Options = {
      target,
      changeOrigin: true,
      onProxyReq: (proxyReq: ClientRequest, req: IncomingMessage) => {
        // ── SECURITY: strip client-supplied identity headers BEFORE anything else ─
        // IMPORTANT: these calls must happen before fixRequestBody() because
        // fixRequestBody() calls proxyReq.write() which flushes the headers,
        // making any subsequent removeHeader/setHeader throw ERR_HTTP_HEADERS_SENT.
        proxyReq.removeHeader('X-User-Id');
        proxyReq.removeHeader('X-Username');
        proxyReq.removeHeader('X-Authorities');
        proxyReq.removeHeader('X-Customer-Id');
        proxyReq.removeHeader('X-Internal-Key');

        const auth = (req as Request).headers?.authorization;
        if (auth?.startsWith('Bearer ')) {
          const token  = auth.slice(7);
          const secret = process.env.JWT_SECRET;

          // ── Admin / staff token (type:'access') — MUST be signature-verified ──
          if (secret) {
            try {
              const verified = jwt.verify(token, secret) as Record<string, any>;
              if (verified?.type === 'access' && verified?.userId) {
                proxyReq.setHeader('X-User-Id',     String(verified.userId));
                proxyReq.setHeader('X-Username',    String(verified.sub ?? ''));
                proxyReq.setHeader('X-Authorities', JSON.stringify(verified.authorities ?? []));
              }
            } catch { /* Expired or tampered — headers remain absent */ }
          }

          // ── Customer token (type:'customer_access') — signature-verified ──────
          const customerSecret = process.env.CUSTOMER_JWT_SECRET ?? process.env.JWT_SECRET;
          if (customerSecret) {
            try {
              const customerPayload = jwt.verify(token, customerSecret) as Record<string, any>;
              if (customerPayload?.type === 'customer_access' && customerPayload?.sub) {
                proxyReq.setHeader('X-Customer-Id', String(customerPayload.sub));
              }
            } catch { /* Expired or tampered customer JWT — X-Customer-Id remains absent */ }
          }
        }

        // ── Re-inject body LAST — fixRequestBody calls proxyReq.write() which ───
        // flushes the request headers; no header modifications are possible after.
        fixRequestBody(proxyReq, req as Request);
      },
      onError: (err: Error, _req: IncomingMessage, res: any) => {
        res.status(502).json({ message: 'Bad Gateway', error: err.message });
      },
    };

    createProxyMiddleware(proxyOptions)(req, res, next);
  }
}
