/**
 * SOURCE OF TRUTH KEYWORDS: middleware, edge-delegate, auth-headers, nextjs-middleware
 * WHAT: Thin Next.js middleware entrypoint that delegates every request to edgeProxy in src/proxy.ts
 * WHY: Next.js only executes a file named middleware.ts at the edge; all guard logic
 *      (JWT verification, rate limiting, RBAC, auth header injection) lives in src/proxy.ts
 *      and this file contains no guard logic of its own.
 * WHERE: src/middleware.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { edgeProxy } from "./proxy";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const result = await edgeProxy(request);
  return result ?? NextResponse.next();
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
