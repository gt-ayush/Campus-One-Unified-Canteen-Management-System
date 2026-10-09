/**
 * SOURCE OF TRUTH KEYWORDS: api, canteens, detail, menu, slots, merchant, dashboard
 * WHAT: GET /api/v1/canteens/:id - Detailed canteen view with full menu and slots
 * WHY: Provides complete canteen information for student ordering and merchant management
 * WHERE: src/app/api/v1/canteens/[id]/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuthContext } from "@/lib/auth/server-auth";
import { UserRole } from "@/lib/types/domain";
import { prisma } from "@/lib/db/client";

export async function GET(
  request: NextRequest,
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

    const slotsWithAvailability = canteen.pickupSlots.map((slot) => ({
      ...slot,
      availableCapacity: slot.capacityLimit - slot.reservedCount,
      isFull: slot.reservedCount >= slot.capacityLimit,
    }));

    const menuByCategory = canteen.menuItems.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push({
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