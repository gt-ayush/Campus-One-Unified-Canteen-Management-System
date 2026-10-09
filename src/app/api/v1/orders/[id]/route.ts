/**
 * SOURCE OF TRUTH KEYWORDS: api, orders, detail, get, rbac, tenant-isolation
 * WHAT: GET /api/v1/orders/:id - Fetch a single order with items, slot, canteen, and payment details
 * WHY: Powers the student order tracker and merchant order views; enforces ownership (student sees own orders, merchants see own canteen only)
 * WHERE: src/app/api/v1/orders/[id]/route.ts
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

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { menuItem: true } },
        pickupSlot: true,
        canteen: { select: { id: true, name: true, address: true } },
        student: { include: { user: { select: { id: true, email: true } } } },
        payment: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found", errorCode: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (authContext.role === UserRole.STUDENT) {
      const studentProfileId = authContext.studentProfileId;
      if (!studentProfileId || order.studentId !== studentProfileId) {
        return NextResponse.json(
          { success: false, error: "Cannot access other students' orders", errorCode: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    if (
      authContext.role === UserRole.MERCHANT_STAFF &&
      authContext.canteenId !== order.canteenId
    ) {
      return NextResponse.json(
        { success: false, error: "Cannot access orders from other canteens", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error("Order detail error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
