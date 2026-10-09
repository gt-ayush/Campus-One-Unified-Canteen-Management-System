/**
 * SOURCE OF TRUTH KEYWORDS: api, canteens, detail, menu, slots, merchant, dashboard
 * WHAT: GET /api/v1/canteens/:id - Detailed canteen view with full menu and slots.
 *        PATCH /api/v1/canteens/:id - Admin-only canteen approval (approve/reject).
 * WHY: Provides complete canteen information for student ordering and merchant management
 * WHERE: src/app/api/v1/canteens/[id]/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOptionalAuthContext, getAuthContext } from "@/lib/auth/server-auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/client";

const canteenApprovalSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(1000).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = getOptionalAuthContext();
    const { id } = await params;

    const canteen = await prisma.canteen.findUnique({
      where: { id },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
        },
        pickupSlots: {
          where: { isActive: true },
          orderBy: { startTime: "asc" },
        },
      },
    });

    if (!canteen) {
      return NextResponse.json(
        { success: false, error: "Canteen not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!canteen.isApproved && authContext?.role !== UserRole.ADMIN && authContext?.canteenId !== id) {
      return NextResponse.json(
        { success: false, error: "Canteen not available", errorCode: "NOT_APPROVED" },
        { status: 404 }
      );
    }

    const slotsWithAvailability = canteen.pickupSlots.map((slot: typeof canteen.pickupSlots[0]) => ({
      ...slot,
      availableCapacity: slot.capacityLimit - slot.reservedCount,
      isFull: slot.reservedCount >= slot.capacityLimit,
    }));

    const menuByCategory = canteen.menuItems.reduce((acc: Record<string, any[]>, item: typeof canteen.menuItems[0]) => {
      if (!acc[item.category]) acc[item.category] = [];
      (acc[item.category]!).push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        stockQuantity: item.stockQuantity,
        maxPerOrder: item.maxPerOrder,
        imageUrl: item.imageUrl,
        dietaryTags: item.dietaryTags,
        preparationTime: item.preparationTime,
      });
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      success: true,
      data: {
        id: canteen.id,
        name: canteen.name,
        description: canteen.description,
        address: canteen.address,
        phone: canteen.phone,
        email: canteen.email,
        latitude: Number(canteen.latitude),
        longitude: Number(canteen.longitude),
        operatingHours: canteen.operatingHours,
        isApproved: canteen.isApproved,
        menuByCategory,
        pickupSlots: slotsWithAvailability,
      },
    });
  } catch (error) {
    console.error("Canteen detail error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = getAuthContext();

    if (authContext.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "Admin access required", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = canteenApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          errorCode: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const existing = await prisma.canteen.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Canteen not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const approved = parsed.data.action === "approve";
    const updated = await prisma.canteen.update({
      where: { id },
      data: {
        isApproved: approved,
        approvedAt: approved ? new Date() : existing.approvedAt,
        approvedBy: approved ? authContext.id : existing.approvedBy,
      },
    });

    // NOTE: No audit-log row is written here on purpose. AuditLog.entityId
    // carries a foreign key to Order.id, so any audit row whose entity is not
    // an order is rejected by the database (P2003). An audit trail for
    // approvals needs that schema-level issue resolved first.

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        isApproved: updated.isApproved,
        approvedAt: updated.approvedAt,
        rejectionNotes: approved ? null : (parsed.data.notes ?? null),
      },
    });
  } catch (error) {
    console.error("Canteen approval error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
