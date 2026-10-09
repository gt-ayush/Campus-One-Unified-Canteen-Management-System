/**
 * SOURCE OF TRUTH KEYWORDS: api, auth, login, jwt, token, authentication, credentials
 * WHAT: POST /api/v1/auth/login - User authentication with JWT token generation
 * WHY: Secure login with email/password verification and access/refresh token issuance
 * WHERE: src/app/api/v1/auth/login/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validators/schemas";
import { createAccessToken, createRefreshToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/client";
import { UserStatus, AuthenticatedUser, UserRole } from "@/lib/types/domain";
import { compare } from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid credentials",
          errorCode: "VALIDATION_ERROR",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        studentProfile: true,
        merchantStaff: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password", errorCode: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      return NextResponse.json(
        { success: false, error: `Account is ${user.status.toLowerCase()}`, errorCode: "ACCOUNT_NOT_ACTIVE" },
        { status: 403 }
      );
    }

    const isValidPassword = await compare(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password", errorCode: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    const baseAuthUser = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      status: user.status as UserStatus,
    };

    if (user.studentProfile?.id) (baseAuthUser as any).studentProfileId = user.studentProfile.id;
    if (user.merchantStaff?.id) (baseAuthUser as any).merchantStaffId = user.merchantStaff.id;
    if (user.merchantStaff?.canteenId) (baseAuthUser as any).canteenId = user.merchantStaff.canteenId;

    const authUser = baseAuthUser as AuthenticatedUser;

    const accessToken = await createAccessToken(authUser);
    const refreshToken = await createRefreshToken(user.id);

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          studentProfile: user.studentProfile,
          merchantStaff: user.merchantStaff,
        },
        accessToken,
        refreshToken,
      },
    });

    response.cookies.set("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}