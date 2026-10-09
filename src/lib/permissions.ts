/**
 * SOURCE OF TRUTH KEYWORDS: Permissions, RBAC, RolePermissions, AccessControl, Authorization, Security
 * WHAT: Defines granular role-based access control (RBAC) permissions and check utilities for all actors.
 * WHY: Centralizes authorization rules to prevent unauthorized state mutations or data exposure across layers.
 * WHERE: Consumed by server procedures, API route handlers, and service layer guards.
 */

export type Role = 'STUDENT' | 'MERCHANT_STAFF' | 'ADMIN';

export type Permission =
  // Student permissions
  | 'order:create'
  | 'order:read_own'
  | 'order:cancel_own'
  | 'pass:read_own'
  | 'pass:purchase'
  // Merchant permissions
  | 'canteen:update_menu'
  | 'canteen:update_slots'
  | 'order:read_canteen'
  | 'order:update_status'
  | 'order:verify_qr'
  | 'settlement:read_own'
  // Admin permissions
  | 'canteen:approve'
  | 'canteen:suspend'
  | 'package:manage'
  | 'dispute:resolve'
  | 'settlement:generate'
  | 'audit:read';

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  STUDENT: [
    'order:create',
    'order:read_own',
    'order:cancel_own',
    'pass:read_own',
    'pass:purchase',
  ],
  MERCHANT_STAFF: [
    'canteen:update_menu',
    'canteen:update_slots',
    'order:read_canteen',
    'order:update_status',
    'order:verify_qr',
    'settlement:read_own',
  ],
  ADMIN: [
    'canteen:approve',
    'canteen:suspend',
    'package:manage',
    'dispute:resolve',
    'settlement:generate',
    'audit:read',
    'order:read_own',
    'order:read_canteen',
    'pass:read_own',
  ],
} as const;

/**
 * Verifies if a given role possesses a specific permission.
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Verifies if a role possesses all provided permissions.
 */
export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}