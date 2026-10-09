/**
 * SOURCE OF TRUTH KEYWORDS: api, health, check, status, monitoring, uptime
 * WHAT: GET /api/v1/health - Health check endpoint for monitoring and load balancer probes
 * WHY: Provides system health status for infrastructure monitoring
 * WHERE: src/app/api/v1/health/route.ts
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        database: "connected",
        version: process.env.npm_package_version || "1.0.0",
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        success: false,
        data: {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          database: "disconnected",
        },
      },
      { status: 503 }
    );
  }
}