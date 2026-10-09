/**
 * SOURCE OF TRUTH KEYWORDS: api, orders, post, create, atomic, validation, rbac, student
 * WHAT: POST /api/v1/orders - Create new order with atomic stock/slot/pass reservation
 * WHY: Handles order submission with full validation, atomic transactions, and alternative suggestions
 * WHERE: src/app/api/v1/orders/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createOrderAtomically } from "@/lib/services/order-service";
import { createOrderSchema } from "@/lib/validators/schemas";
import { getAuthContext, createOrderContext } from "@/lib/auth/server-auth";
import { UserRole } from "@prisma/client";

export async function POST(request: NextRequest) {
  try {
    const authContext = getAuthContext();
    
    if (authContext.role !== UserRole.STUDENT) {
      return NextResponse.json(
        { success: false, error: "Only students can create orders", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createOrderSchema.safeParse(body);

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

    const orderContext = createOrderContext(authContext);
    const orderInput = {
      ...validation.data,
      studentId: authContext.studentProfileId!,
    };
    const result = await createOrderAtomically(orderInput, orderContext);

    if (!result.success) {
      const errorCode = (result as any).errorCode || "ORDER_CREATION_FAILED";
      const statusCode = errorCode === "PICKUP_SLOT_FULL" || errorCode === "INSUFFICIENT_STOCK" ? 409 : 400;
      
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Failed to create order",
          errorCode,
          data: result.alternatives ? { alternatives: result.alternatives } : undefined,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          message: "Order created successfully. Awaiting canteen confirmation.",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order creation error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("Insufficient food pass credits")) {
        return NextResponse.json(
          { success: false, error: error.message, errorCode: "INSUFFICIENT_CREDITS" },
          { status: 400 }
        );
      }
      if (error.message.includes("Pickup slot has already ended")) {
        return NextResponse.json(
          { success: false, error: error.message, errorCode: "SLOT_EXPIRED" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authContext = getAuthContext();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") as any;

    const where: any = {};
    
    if (authContext.role === UserRole.STUDENT) {
      where.studentId = authContext.studentProfileId;
    } else if (authContext.role === UserRole.MERCHANT_STAFF) {
      where.canteenId = authContext.canteenId;
    }
    // Admin can see all orders (no additional filter)

    if (status) where.status = status;

    const { prisma } = await import("@/lib/db/client");
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: { include: { menuItem: true } },
          pickupSlot: true,
          canteen: { select: { id: true, name: true, address: true } },
          payment: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Order list error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}