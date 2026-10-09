/**
 * SOURCE OF TRUTH KEYWORDS: api, alternatives, suggestions, recommendation, consent, student
 * WHAT: POST /api/v1/orders/alternatives - Get alternative canteen suggestions when item/slot unavailable
 * WHY: Provides ranked alternatives with user consent enforcement - never silently redirects
 * WHERE: src/app/api/v1/orders/alternatives/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { findAlternatives } from "@/lib/recommendation/alternative-engine";
import { alternativeRequestSchema, apiResponseSchema } from "@/lib/validators/schemas";
import { getAuthContext } from "@/lib/auth/server-auth";
import { UserRole } from "@/lib/types/domain";

export async function POST(request: NextRequest) {
  try {
    const authContext = getAuthContext();

    if (authContext.role !== UserRole.STUDENT) {
      return NextResponse.json(
        { success: false, error: "Only students can request alternatives", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = alternativeRequestSchema.safeParse(body);

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

    const result = await findAlternatives({
      ...validation.data,
      studentId: authContext.studentProfileId!,
    });

    return NextResponse.json({
      success: true,
      data: {
        alternatives: result.alternatives,
        originalUnavailable: result.originalUnavailable,
        originalSlotFull: result.originalSlotFull,
        message: result.alternatives.length > 0
          ? "Alternative options found. Please review and confirm your choice."
          : "No suitable alternatives available at this time.",
      },
    });
  } catch (error) {
    console.error("Alternative suggestions error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}