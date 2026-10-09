/**
 * SOURCE OF TRUTH KEYWORDS: auth, server, context, headers, user, rbac, middleware
 * WHAT: Server-side authentication context extraction from proxy headers
 * WHY: Retrieves authenticated user info set by edge proxy for use in API routes and services
 * WHERE: src/lib/auth/server-auth.ts
 */

import { headers } from "next/headers";
import { AuthenticatedUser, UserRole, UserStatus } from "@/lib/types/domain";

export function getAuthContext(): AuthenticatedUser {
  const headersList = headers();
  
  const userId = headersList.get("x-user-id");
  const userRole = headersList.get("x-user-role") as UserRole;
  const userEmail = headersList.get("x-user-email");
  const studentProfileId = headersList.get("x-student-profile-id");
  const merchantStaffId = headersList.get("x-merchant-staff-id");
  const canteenId = headersList.get("x-canteen-id");

  if (!userId || !userRole || !userEmail) {
    throw new Error("Authentication context not found. Ensure proxy.ts is configured.");
  }

  const base = {
    id: userId,
    email: userEmail,
    role: userRole,
    status: UserStatus.ACTIVE,
  };

  if (studentProfileId) (base as any).studentProfileId = studentProfileId;
  if (merchantStaffId) (base as any).merchantStaffId = merchantStaffId;
  if (canteenId) (base as any).canteenId = canteenId;

  return base as AuthenticatedUser;
}

export function getOptionalAuthContext(): AuthenticatedUser | null {
  try {
    return getAuthContext();
  } catch {
    return null;
  }
}

export function assertAuthContext(): AuthenticatedUser {
  const context = getAuthContext();
  if (!context) {
    throw new Error("Unauthorized: Authentication required");
  }
  return context;
}

export function createOrderContext(context: AuthenticatedUser) {
  const base = {
    actorId: context.studentProfileId || context.merchantStaffId || context.id,
    actorRole: context.role,
  };
  if (context.canteenId) {
    return { ...base, canteenId: context.canteenId };
  }
  return base;
}