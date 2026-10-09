/**
 * SOURCE OF TRUTH KEYWORDS: api, auth, refresh, token, jwt, access-token, rotation
 * WHAT: POST /api/v1/auth/refresh - Refresh access token using refresh token
 * WHY: Implements token rotation for improved security with short-lived access tokens
 * WHERE: src/app/api/v1/auth/refresh/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken, createAccessToken, createRefreshToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/client";
import { UserRole, UserStatus } from "@/lib/types/domain";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get("refreshToken")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: "Refresh token required", errorCode: "TOKEN_MISSING" },
        { status: 401 }
      );
    }

    const userId = await verifyRefreshToken(refreshToken);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired refresh token", errorCode: "TOKEN_INVALID" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true, merchantStaff: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      return NextResponse.json(
        { success: false, error: "User not found or inactive", errorCode: "USER_INACTIVE" },
        { status: 401 }
      );
    }

    const authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      studentProfileId: user.studentProfile?.id,
      merchantStaffId: user.merchantStaff?.id,
      canteenId: user.merchantStaff?.canteenId,
    };

    const newAccessToken = await createAccessToken(authUser);
    const newRefreshToken = await createRefreshToken(user.id);

    const response = NextResponse.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          studentProfile: user.studentProfile,
          merchantStaff: user.merchantStaff,
        },
      },
    });

    response.cookies.set("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}