/**
 * SOURCE OF TRUTH KEYWORDS: api, canteens, list, browse, student, location, distance
 * WHAT: GET /api/v1/canteens - Browse approved canteens with location and basic info
 * WHY: Allows students to discover canteens with distance calculation and operating hours
 * WHERE: src/app/api/v1/canteens/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { paginationSchema, apiResponseSchema } from "@/lib/validators/schemas";
import { getOptionalAuthContext } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/db/client";

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(request: NextRequest) {
  try {
    const authContext = getOptionalAuthContext();
    const { searchParams } = new URL(request.url);

    const validation = paginationSchema.safeParse(Object.fromEntries(searchParams));
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid query parameters", errorCode: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { page, limit, sortBy, sortOrder } = validation.data;
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const radius = searchParams.get("radius");

    const where: any = { isApproved: true };

    const canteens = await prisma.canteen.findMany({
      where,
      include: {
        menuItems: {
          where: { isAvailable: true },
          select: { id: true, name: true, price: true, category: true },
          take: 5,
        },
        pickupSlots: {
          where: { isActive: true },
          orderBy: { startTime: "asc" },
          take: 10,
        },
        _count: { select: { menuItems: true } },
      },
      orderBy: { [sortBy || "name"]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    let canteensWithDistance = canteens.map((canteen) => {
      let distance: number | null = null;
      if (lat && lng) {
        distance = haversineDistance(
          parseFloat(lat),
          parseFloat(lng),
          Number(canteen.latitude),
          Number(canteen.longitude)
        );
      }

      if (radius && distance !== null && distance > parseFloat(radius)) {
        return null;
      }

      const nextSlot = canteen.pickupSlots.find(
        (slot) => slot.startTime > new Date()
      );

      return {
        id: canteen.id,
        name: canteen.name,
        address: canteen.address,
        phone: canteen.phone,
        distanceKm: distance ? Math.round(distance * 10) / 10 : null,
        operatingHours: canteen.operatingHours,
        sampleMenu: canteen.menuItems,
        nextPickupSlot: nextSlot
          ? {
              id: nextSlot.id,
              startTime: nextSlot.startTime,
              endTime: nextSlot.endTime,
              availableCapacity: nextSlot.capacityLimit - nextSlot.reservedCount,
            }
          : null,
        totalMenuItems: canteen._count.menuItems,
      };
    }).filter(Boolean);

    if (lat && lng) {
      canteensWithDistance.sort((a, b) => (a!.distanceKm ?? Infinity) - (b!.distanceKm ?? Infinity));
    }

    const total = await prisma.canteen.count({ where: { isApproved: true } });

    return NextResponse.json({
      success: true,
      data: canteensWithDistance,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Canteens list error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}