/**
 * SOURCE OF TRUTH KEYWORDS: api, pickup-slots, update, delete, merchant, tenant-isolation
 * WHAT: PATCH/DELETE /api/v1/pickup-slots/:id - Update or delete a pickup slot (merchants own canteen only)
 * WHY: Powers the merchant capacity manager; mutations are restricted to the owning canteen's staff or admins
 * WHERE: src/app/api/v1/pickup-slots/[id]/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { updatePickupSlotSchema } from "@/lib/validators/schemas";
import { getAuthContext } from "@/lib/auth/server-auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/client";

function canMutate(authCanteenId: string | undefined, role: UserRole, slotCanteenId: string): boolean {
  if (role === UserRole.ADMIN) return true;
  if (role === UserRole.MERCHANT_STAFF && authCanteenId === slotCanteenId) return true;
  return false;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = getAuthContext();
    const { id } = await params;

    const slot = await prisma.pickupSlot.findUnique({ where: { id } });
    if (!slot) {
      return NextResponse.json(
        { success: false, error: "Pickup slot not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!canMutate(authContext.canteenId, authContext.role, slot.canteenId)) {
      return NextResponse.json(
        { success: false, error: "Cannot modify another canteen's slots", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = updatePickupSlotSchema.safeParse(body);
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

    const data = validation.data;
    if (data.capacityLimit !== undefined && data.capacityLimit < slot.reservedCount) {
      return NextResponse.json(
        {
          success: false,
          error: `Capacity cannot go below ${slot.reservedCount} already reserved orders`,
          errorCode: "CAPACITY_BELOW_RESERVED",
        },
        { status: 400 }
      );
    }

    const updated = await prisma.pickupSlot.update({
      where: { id },
      data: {
        ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
        ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
        ...(data.capacityLimit !== undefined ? { capacityLimit: data.capacityLimit } : {}),
        ...(data.preparationBuffer !== undefined ? { preparationBuffer: data.preparationBuffer } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Pickup slot updated successfully",
    });
  } catch (error) {
    console.error("Pickup slot update error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = getAuthContext();
    const { id } = await params;

    const slot = await prisma.pickupSlot.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!slot) {
      return NextResponse.json(
        { success: false, error: "Pickup slot not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!canMutate(authContext.canteenId, authContext.role, slot.canteenId)) {
      return NextResponse.json(
        { success: false, error: "Cannot modify another canteen's slots", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (slot._count.orders > 0) {
      await prisma.pickupSlot.update({ where: { id }, data: { isActive: false } });
      return NextResponse.json({
        success: true,
        data: { id, isActive: false },
        message: "Slot has existing orders, so it was deactivated instead of deleted",
      });
    }

    await prisma.pickupSlot.delete({ where: { id } });
    return NextResponse.json({
      success: true,
      data: { id },
      message: "Pickup slot deleted successfully",
    });
  } catch (error) {
    console.error("Pickup slot delete error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
