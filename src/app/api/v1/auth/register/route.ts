/**
 * SOURCE OF TRUTH KEYWORDS: api, auth, register, student, merchant, signup, onboarding
 * WHAT: POST /api/v1/auth/register - Student and merchant registration with role-based onboarding
 * WHY: Handles new user registration with profile creation and canteen setup for merchants
 * WHERE: src/app/api/v1/auth/register/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { registerStudentSchema, registerMerchantSchema } from "@/lib/validators/schemas";
import { prisma } from "@/lib/db/client";
import { hash } from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role, ...data } = body;

    if (role === "STUDENT") {
      return await registerStudent(data);
    } else if (role === "MERCHANT_STAFF") {
      return await registerMerchant(data);
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid role. Must be STUDENT or MERCHANT_STAFF", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

async function registerStudent(data: any) {
  const validation = registerStudentSchema.safeParse(data);
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid registration data",
        errorCode: "VALIDATION_ERROR",
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { email, password, studentId, fullName, phone, campusId, department, yearOfStudy } = validation.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { success: false, error: "Email already registered", errorCode: "EMAIL_EXISTS" },
      { status: 409 }
    );
  }

  const existingStudent = await prisma.studentProfile.findUnique({ where: { studentId } });
  if (existingStudent) {
    return NextResponse.json(
      { success: false, error: "Student ID already registered", errorCode: "STUDENT_ID_EXISTS" },
      { status: 409 }
    );
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.STUDENT,
      status: UserStatus.PENDING_VERIFICATION,
      studentProfile: {
        create: {
          studentId,
          fullName,
          phone: phone ?? null,
          campusId,
          department: department ?? null,
          yearOfStudy: yearOfStudy ?? null,
          isVerified: false,
        },
      },
    },
    include: { studentProfile: true },
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          studentProfile: user.studentProfile,
        },
      },
      message: "Registration successful. Account pending verification.",
    },
    { status: 201 }
  );
}

async function registerMerchant(data: any) {
  const validation = registerMerchantSchema.safeParse(data);
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid registration data",
        errorCode: "VALIDATION_ERROR",
        details: validation.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const {
    email,
    password,
    canteenName,
    canteenAddress,
    canteenPhone,
    canteenEmail,
    latitude,
    longitude,
    operatingHours,
    settlementInfo,
  } = validation.data;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { success: false, error: "Email already registered", errorCode: "EMAIL_EXISTS" },
      { status: 409 }
    );
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.MERCHANT_STAFF,
      status: UserStatus.PENDING_VERIFICATION,
      merchantStaff: {
        create: {
          canteen: {
            create: {
              name: canteenName,
              address: canteenAddress,
              phone: canteenPhone,
              email: canteenEmail,
              latitude,
              longitude,
              operatingHours,
              settlementInfo,
              isApproved: false,
              commissionRate: 0.10,
            },
          },
          fullName: data.contactName || "Manager",
          position: "Manager",
          phone: canteenPhone,
          isActive: true,
        },
      },
    },
    include: {
      merchantStaff: {
        include: { canteen: true },
      },
    },
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          merchantStaff: user.merchantStaff,
        },
      },
      message: "Merchant registration submitted. Awaiting admin approval.",
    },
    { status: 201 }
  );
}