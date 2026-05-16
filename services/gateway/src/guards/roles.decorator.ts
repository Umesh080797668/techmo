import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * @Roles(...roles) — restrict an endpoint to one or more role names.
 * The role names must match what the JWT `authorities` claim contains
 * AFTER stripping the "ROLE_" prefix (e.g. 'SUPER_ADMIN', 'ADMIN').
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
