/**
 * SOURCE OF TRUTH KEYWORDS: api, food-passes, detail, student, wallet
 * WHAT: GET /api/v1/food-passes/:id - Fetch a single food pass (students see their own passes only)
 * WHY: Powers the wallet widget detail view with strict ownership scoping
 * WHERE: src/app/api/v1/food-passes/[id]/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/server-auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = getAuthContext();
    const { id } = await params;

    const pass = await prisma.foodPass.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, fullName: true, studentId: true } },
      },
    });

    if (!pass) {
      return NextResponse.json(
        { success: false, error: "Food pass not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (
      authContext.role === UserRole.STUDENT &&
      authContext.studentProfileId !== pass.studentId
    ) {
      return NextResponse.json(
        { success: false, error: "Cannot access other students' passes", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (
      authContext.role !== UserRole.STUDENT &&
      authContext.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: pass });
  } catch (error) {
    console.error("Food pass detail error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
