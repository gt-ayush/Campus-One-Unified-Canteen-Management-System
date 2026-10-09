/**
 * SOURCE OF TRUTH KEYWORDS: OrganizationRoles, RoleHierarchy, ContextResolution, ActorGuard
 * WHAT: Manages role context resolution, metadata mapping, and scoping rules for student profiles and canteen ownership.
 * WHY: Ensures user identity context correctly scopes database queries to prevent cross-tenant data leaks.
 * WHERE: Imported by authentication middleware, session contexts, and service resolvers.
 */

import { Role } from './permissions';

export interface UserSessionContext {
  userId: string;
  email: string;
  role: Role;
  studentProfileId?: string;
  canteenId?: string;
}

/**
 * Asserts that a user session carries required domain identifiers based on role.
 */
export function validateSessionContext(context: UserSessionContext): void {
  if (context.role === 'STUDENT' && !context.studentProfileId) {
    throw new Error('Invalid Context: STUDENT role missing studentProfileId');
  }
  if (context.role === 'MERCHANT_STAFF' && !context.canteenId) {
    throw new Error('Invalid Context: MERCHANT_STAFF role missing canteenId');
  }
}