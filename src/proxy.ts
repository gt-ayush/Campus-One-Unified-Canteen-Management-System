/**
 * SOURCE OF TRUTH KEYWORDS: proxy, edge, middleware, routing, guard, authentication, rate-limit
 * WHAT: Edge proxy for request authentication, rate limiting, and RBAC enforcement before app router
 * WHY: Validates JWT at the edge, enforces rate limits, and routes requests with authenticated user context
 * WHERE: src/proxy.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractTokenFromHeader, AuthenticatedUser } from "@/lib/auth/jwt";
import { UserRole, UserStatus } from "@/lib/types/domain";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 100;
const AUTH_RATE_LIMIT_MAX = 10;

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function checkRateLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

const PUBLIC_PATHS = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh",
  "/api/v1/health",
]);

const MERCHANT_PATHS = ["/api/v1/merchants"];
const MERCHANT_WRITE_PATHS = ["/api/v1/menu", "/api/v1/pickup-slots"];
const ADMIN_PATHS = ["/api/v1/admin", "/api/v1/settlements"];

// Public browsing routes: readable without a token (routes themselves use
// optional auth). All other /api/v1/* paths require a valid JWT.
const PUBLIC_GET_PREFIXES = ["/api/v1/canteens"];

export async function edgeProxy(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  if (PUBLIC_PATHS.has(pathname)) {
    return null;
  }

  if (method === "GET" && PUBLIC_GET_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`public:${ip}`, RATE_LIMIT_MAX_REQUESTS);
    if (!rateLimit.allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Rate limit exceeded", code: "RATE_LIMITED" }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
    return null;
  }

  if (pathname.startsWith("/api/v1/auth/")) {
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`auth:${ip}`, AUTH_RATE_LIMIT_MAX);
    if (!rateLimit.allowed) {
      return new NextResponse(
        JSON.stringify({ error: "Too many authentication attempts. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const authHeader = request.headers.get("authorization");
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return new NextResponse(
      JSON.stringify({ error: "Authentication required", code: "UNAUTHORIZED" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return new NextResponse(
      JSON.stringify({ error: "Invalid or expired token", code: "INVALID_TOKEN" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const baseUser = {
    id: payload.sub,
    email: payload.email,
    role: payload.role as UserRole,
    status: UserStatus.ACTIVE,
  };

  if (payload.studentProfileId) (baseUser as any).studentProfileId = payload.studentProfileId;
  if (payload.merchantStaffId) (baseUser as any).merchantStaffId = payload.merchantStaffId;
  if (payload.canteenId) (baseUser as any).canteenId = payload.canteenId;

  const user = baseUser as AuthenticatedUser;

  const isMerchantRoute = MERCHANT_PATHS.some((p) => pathname.startsWith(p));
  const isAdminRoute = ADMIN_PATHS.some((p) => pathname.startsWith(p));
  const isMerchantWriteRoute =
    method !== "GET" &&
    MERCHANT_WRITE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isAdminRoute && user.role !== UserRole.ADMIN) {
    return new NextResponse(
      JSON.stringify({ error: "Admin access required", code: "FORBIDDEN" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (isMerchantRoute && user.role === UserRole.STUDENT) {
    return new NextResponse(
      JSON.stringify({ error: "Merchant access required", code: "FORBIDDEN" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  if (isMerchantWriteRoute && user.role === UserRole.STUDENT) {
    return new NextResponse(
      JSON.stringify({ error: "Merchant access required", code: "FORBIDDEN" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const ip = getClientIp(request);
  const rateLimitKey = `api:${user.id}:${ip}`;
  const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMIT_MAX_REQUESTS);
  if (!rateLimit.allowed) {
    return new NextResponse(
      JSON.stringify({ error: "Rate limit exceeded", code: "RATE_LIMITED" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const response = NextResponse.next();
  response.headers.set("x-user-id", user.id);
  response.headers.set("x-user-role", user.role);
  response.headers.set("x-user-email", user.email);
  if (user.studentProfileId) response.headers.set("x-student-profile-id", user.studentProfileId);
  if (user.merchantStaffId) response.headers.set("x-merchant-staff-id", user.merchantStaffId);
  if (user.canteenId) response.headers.set("x-canteen-id", user.canteenId);
  response.headers.set("x-rate-limit-remaining", rateLimit.remaining.toString());
  response.headers.set("x-rate-limit-reset", rateLimit.resetAt.toString());

  return response;
}

export const config = {
  matcher: [
    "/api/v1/:path*",
  ],
};