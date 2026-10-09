/**
 * SOURCE OF TRUTH KEYWORDS: auth, jwt, verification, middleware, edge, proxy, rbac
 * WHAT: JWT verification and authentication utilities for edge runtime
 * WHY: Provides secure token validation at the edge before requests reach the application layer
 * WHERE: src/lib/auth/jwt.ts
 */

import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { JWTPayload, UserRole, UserStatus, AuthenticatedUser } from "@/lib/types/domain";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-in-production-min-32-chars"
);

const JWT_ISSUER = "campus-food-pass";
const JWT_AUDIENCE = "campus-food-pass-api";
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

export async function createAccessToken(user: AuthenticatedUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    role: user.role,
    studentProfileId: user.studentProfileId,
    merchantStaffId: user.merchantStaffId,
    canteenId: user.canteenId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(JWT_SECRET);
}

export async function createRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (payload.type === "refresh" && typeof payload.sub === "string") {
      return payload.sub;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}

export function hasRole(user: AuthenticatedUser, roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === UserRole.ADMIN;
}

export function isMerchantStaff(user: AuthenticatedUser): boolean {
  return user.role === UserRole.MERCHANT_STAFF;
}

export function isStudent(user: AuthenticatedUser): boolean {
  return user.role === UserRole.STUDENT;
}

export function canAccessCanteen(user: AuthenticatedUser, canteenId: string): boolean {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.MERCHANT_STAFF) {
    return user.canteenId === canteenId;
  }
  return false;
}

export function assertCanteenAccess(user: AuthenticatedUser, canteenId: string): void {
  if (!canAccessCanteen(user, canteenId)) {
    throw new Error("FORBIDDEN: Insufficient permissions to access this canteen's data");
  }
}

export function assertRole(user: AuthenticatedUser, allowedRoles: UserRole[]): void {
  if (!hasRole(user, allowedRoles)) {
    throw new Error(`FORBIDDEN: Required role(s): ${allowedRoles.join(", ")}`);
  }
}

export function assertActiveUser(user: AuthenticatedUser): void {
  if (user.status !== UserStatus.ACTIVE) {
    throw new Error(`FORBIDDEN: User account is ${user.status.toLowerCase()}`);
  }
}