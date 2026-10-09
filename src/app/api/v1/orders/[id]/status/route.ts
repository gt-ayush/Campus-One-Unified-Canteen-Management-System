/**
 * SOURCE OF TRUTH KEYWORDS: api, orders, patch, status, transition, state-machine, audit, rbac
 * WHAT: PATCH /api/v1/orders/:id/status - Update order status with state machine validation and audit logging
 * WHY: Enforces server-side state transitions with role-based permissions and complete audit trail
 * WHERE: src/app/api/v1/orders/[id]/status/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { transitionOrderStatus } from "@/lib/services/order-service";
import { updateOrderStatusSchema } from "@/lib/validators/schemas";
import { getAuthContext, createOrderContext } from "@/lib/auth/server-auth";
import { OrderStatus, UserRole } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = getAuthContext();
    const { id } = await params;

    const body = await request.json();
    const validation = updateOrderStatusSchema.safeParse(body);

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

    const { status: targetStatus, reason } = validation.data;

    const isStudentCancellation = 
      authContext.role === UserRole.STUDENT && 
      targetStatus === OrderStatus.CANCELLED;

    if (isStudentCancellation) {
      // Allow student cancellation - validation happens in service
    } else if (authContext.role === UserRole.MERCHANT_STAFF) {
      // Merchants can confirm, start preparing, mark ready, reject
    } else if (authContext.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const orderContext = createOrderContext(authContext);
    const result = await transitionOrderStatus(id, targetStatus, orderContext, reason);

    if (!result.success) {
      const statusCode = result.error?.includes("FORBIDDEN") ? 403 : 400;
      return NextResponse.json(
        { success: false, error: result.error, errorCode: "TRANSITION_FAILED" },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Order status updated to ${targetStatus}`,
        ...(result.qrToken && { qrToken: result.qrToken }),
      },
    });
  } catch (error) {
    console.error("Order status update error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}