import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

/**
 * RolesGuard — enforces @Roles() decorator restrictions.
 *
 * Reads `req.user.authorities` (populated by JwtStrategy after JWT validation)
 * and checks that at least one of the required roles is present as
 * `ROLE_<roleName>` in the authorities array.
 *
 * Must be used AFTER JwtAuthGuard so that req.user is already populated.
 *
 * Example:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('SUPER_ADMIN')
 *   @Post('activate')
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator → no role restriction for this route
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { authorities?: string[] } | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const authorities: string[] = user.authorities ?? [];
    const hasRole = requiredRoles.some(role =>
      authorities.includes(`ROLE_${role}`)
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
