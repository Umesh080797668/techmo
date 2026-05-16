import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ProxyMiddleware } from './proxy.middleware';
import { IpThrottleMiddleware } from '../middleware/ip-throttle.middleware';
import { RedisService } from '../util/redis.service';

@Module({
  providers: [RedisService],
})
export class ProxyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // ── DDoS protection: rate-limit ALL /api routes BEFORE any proxy ──────────
    consumer
      .apply(IpThrottleMiddleware)
      .forRoutes({ path: '/api/*', method: RequestMethod.ALL });

    // NOTE: /api/v1/auth/* routes (login, refresh, logout, change-password) are
    // handled directly by the gateway's AuthController, which manages the
    // HttpOnly refresh-token cookie bridging. Only audit-logs and admin/users are proxied here.
    consumer.apply(ProxyMiddleware.for('AUTH_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/audit-logs', method: RequestMethod.ALL },
      { path: '/api/v1/audit-logs/*', method: RequestMethod.ALL },
      // SUPER_ADMIN user management — guarded by @PreAuthorize on the auth-service side
      { path: '/api/v1/admin/users', method: RequestMethod.ALL },
      { path: '/api/v1/admin/users/*', method: RequestMethod.ALL },
    );

    // Product Service (products, compatibility, device-models, pricing, warranty, imei)
    consumer.apply(ProxyMiddleware.for('PRODUCT_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/products', method: RequestMethod.ALL },
      { path: '/api/v1/products/*', method: RequestMethod.ALL },
      { path: '/api/v1/compatibility', method: RequestMethod.ALL },
      { path: '/api/v1/compatibility/*', method: RequestMethod.ALL },
      { path: '/api/v1/device-models', method: RequestMethod.ALL },
      { path: '/api/v1/device-models/*', method: RequestMethod.ALL },
      { path: '/api/v1/pricing', method: RequestMethod.ALL },
      { path: '/api/v1/pricing/*', method: RequestMethod.ALL },
      { path: '/api/v1/warranty', method: RequestMethod.ALL },
      { path: '/api/v1/warranty/*', method: RequestMethod.ALL },
      { path: '/api/v1/imei', method: RequestMethod.ALL },
      { path: '/api/v1/imei/*', method: RequestMethod.ALL },
    );

    // Inventory Service
    consumer.apply(ProxyMiddleware.for('INVENTORY_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/inventory', method: RequestMethod.ALL },
      { path: '/api/v1/inventory/*', method: RequestMethod.ALL },
      { path: '/api/v1/stock-movements', method: RequestMethod.ALL },
      { path: '/api/v1/stock-movements/*', method: RequestMethod.ALL },
    );

    // Order / POS Service
    consumer.apply(ProxyMiddleware.for('ORDER_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/orders', method: RequestMethod.ALL },
      { path: '/api/v1/orders/*', method: RequestMethod.ALL },
      { path: '/api/v1/invoices', method: RequestMethod.ALL },
      { path: '/api/v1/invoices/*', method: RequestMethod.ALL },
    );

    // Repair Service
    consumer.apply(ProxyMiddleware.for('REPAIR_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/repairs', method: RequestMethod.ALL },
      { path: '/api/v1/repairs/*', method: RequestMethod.ALL },
    );

    // Loyalty / CRM Service — Customer auth (MUST come before /customers proxy)
    consumer.apply(ProxyMiddleware.for('LOYALTY_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/auth/customer', method: RequestMethod.ALL },
      { path: '/api/v1/auth/customer/*', method: RequestMethod.ALL },
    );

    // Reviews — public GET routes + customer POST + admin moderation
    // Must come BEFORE the general /customers catch-all.
    consumer.apply(ProxyMiddleware.for('LOYALTY_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/reviews', method: RequestMethod.ALL },
      { path: '/api/v1/reviews/*', method: RequestMethod.ALL },
    );

    // Customer — per-customer order/repair/warranty endpoints
    // MUST be registered before the general /customers/* → loyalty catch-all
    consumer.apply(ProxyMiddleware.for('ORDER_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/customers/me/orders', method: RequestMethod.ALL },
      { path: '/api/v1/customers/me/orders/*', method: RequestMethod.ALL },
    );
    consumer.apply(ProxyMiddleware.for('REPAIR_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/customers/me/repairs', method: RequestMethod.ALL },
      { path: '/api/v1/customers/me/repairs/*', method: RequestMethod.ALL },
    );
    consumer.apply(ProxyMiddleware.for('PRODUCT_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/customers/me/warranty', method: RequestMethod.ALL },
      { path: '/api/v1/customers/me/warranty/*', method: RequestMethod.ALL },
    );

    // Loyalty / CRM Service
    consumer.apply(ProxyMiddleware.for('LOYALTY_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/customers', method: RequestMethod.ALL },
      { path: '/api/v1/customers/*', method: RequestMethod.ALL },
      { path: '/api/v1/loyalty', method: RequestMethod.ALL },
      { path: '/api/v1/loyalty/*', method: RequestMethod.ALL },
    );

    // HR Service — shifts MUST be registered before /employees/* to avoid wildcard capture
    consumer.apply(ProxyMiddleware.for('HR_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/shifts', method: RequestMethod.ALL },
      { path: '/api/v1/shifts/*', method: RequestMethod.ALL },
    );

    consumer.apply(ProxyMiddleware.for('HR_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/employees', method: RequestMethod.ALL },
      { path: '/api/v1/employees/*', method: RequestMethod.ALL },
      { path: '/api/v1/attendance', method: RequestMethod.ALL },
      { path: '/api/v1/attendance/*', method: RequestMethod.ALL },
      { path: '/api/v1/payroll', method: RequestMethod.ALL },
      { path: '/api/v1/payroll/*', method: RequestMethod.ALL },
    );

    // Worker Service
    consumer.apply(ProxyMiddleware.for('WORKER_SERVICE_URL', '')).forRoutes(
      { path: '/api/v1/worker', method: RequestMethod.ALL },
      { path: '/api/v1/worker/*', method: RequestMethod.ALL },
    );
  }
}
