/**
 * SOURCE OF TRUTH KEYWORDS: api, pickup-slots, schedule, capacity, merchant, management
 * WHAT: GET/POST /api/v1/pickup-slots - Pickup slot management with capacity tracking
 * WHY: Allows merchants to configure pickup windows with capacity limits for rush hour management
 * WHERE: src/app/api/v1/pickup-slots/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createPickupSlotSchema } from "@/lib/validators/schemas";
import { getAuthContext } from "@/lib/auth/server-auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export async function GET(request: NextRequest) {
  try {
    const authContext = getAuthContext();
    const { searchParams } = new URL(request.url);

    const canteenId = searchParams.get("canteenId") || authContext.canteenId;
    const date = searchParams.get("date");
    const isActive = searchParams.get("isActive");

    if (!canteenId) {
      return NextResponse.json(
        { success: false, error: "Canteen ID required", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (authContext.role === UserRole.MERCHANT_STAFF && authContext.canteenId !== canteenId) {
      return NextResponse.json(
        { success: false, error: "Cannot access other canteen's slots", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const where: any = { canteenId };
    if (isActive !== null) where.isActive = isActive === "true";
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.startTime = { gte: startOfDay, lte: endOfDay };
    }

    const slots = await prisma.pickupSlot.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        _count: { select: { orders: true } },
      },
    });

    const slotsWithAvailability = slots.map((slot: typeof slots[0]) => ({
      ...slot,
      availableCapacity: slot.capacityLimit - slot.reservedCount,
      isFull: slot.reservedCount >= slot.capacityLimit,
    }));

    return NextResponse.json({ success: true, data: slotsWithAvailability });
  } catch (error) {
    console.error("Pickup slots list error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = getAuthContext();

    if (authContext.role !== UserRole.MERCHANT_STAFF && authContext.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "Only merchants can create pickup slots", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createPickupSlotSchema.safeParse(body);

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

    const canteenId = authContext.role === UserRole.ADMIN
      ? validation.data.canteenId
      : authContext.canteenId!;

    const slot = await prisma.pickupSlot.create({
      data: {
        ...validation.data,
        canteenId,
      },
    });

    return NextResponse.json(
      { success: true, data: slot, message: "Pickup slot created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Pickup slot creation error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}