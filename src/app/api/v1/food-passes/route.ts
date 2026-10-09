/**
 * SOURCE OF TRUTH KEYWORDS: api, food-passes, packages, credits, student, purchase, admin
 * WHAT: GET/POST /api/v1/food-passes - Food pass management for prepaid meal packages
 * WHY: Handles prepaid package purchases, credit tracking, and validity periods
 * WHERE: src/app/api/v1/food-passes/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createFoodPassSchema, apiResponseSchema } from "@/lib/validators/schemas";
import { getAuthContext } from "@/lib/auth/server-auth";
import { UserRole } from "@/lib/types/domain";
import { prisma } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  try {
    const authContext = getAuthContext();
    const { searchParams } = new URL(request.url);

    const studentId = searchParams.get("studentId") || authContext.studentProfileId;
    const status = searchParams.get("status");

    if (!studentId && authContext.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "Student ID required", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (authContext.role === UserRole.STUDENT && studentId !== authContext.studentProfileId) {
      return NextResponse.json(
        { success: false, error: "Cannot access other student's passes", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const where: any = { studentId };
    if (status) where.status = status;

    const passes = await prisma.foodPass.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { id: true, fullName: true, studentId: true } },
      },
    });

    return NextResponse.json({ success: true, data: passes });
  } catch (error) {
    console.error("Food passes list error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = getAuthContext();

    if (authContext.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "Only admins can create food passes", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createFoodPassSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          errorCode: "VALIDATION_ERROR",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const pass = await prisma.foodPass.create({
      data: {
        ...validation.data,
        remainingCredits: validation.data.totalCredits,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(
      { success: true, data: pass, message: "Food pass created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Food pass creation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}