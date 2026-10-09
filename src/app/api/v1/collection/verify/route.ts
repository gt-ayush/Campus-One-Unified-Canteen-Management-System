/**
 * SOURCE OF TRUTH KEYWORDS: api, collection, verify, qr, scan, single-use, token, collected
 * WHAT: POST /api/v1/collection/verify - Verify QR token and mark order as collected
 * WHY: Single-use QR verification with replay prevention and atomic status transition
 * WHERE: src/app/api/v1/collection/verify/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyQRToken, invalidateQRToken, markQRTokenVerified } from "@/lib/qr-engine/qr-token-engine";
import { verifyQRSchema } from "@/lib/validators/schemas";
import { getAuthContext, createOrderContext } from "@/lib/auth/server-auth";
import { AuditAction, OrderStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export async function POST(request: NextRequest) {
  try {
    const authContext = getAuthContext();

    if (authContext.role !== UserRole.MERCHANT_STAFF && authContext.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: "Only merchant staff can verify collections", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = verifyQRSchema.safeParse(body);

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

    const { token } = validation.data;
    const verification = await verifyQRToken(token);

    if (!verification.valid) {
      const statusCode = verification.error?.includes("expired") ? 410 : 400;
      return NextResponse.json(
        {
          success: false,
          error: verification.error || "Invalid QR token",
          errorCode: "INVALID_QR_TOKEN",
          orderStatus: verification.orderStatus,
        },
        { status: statusCode }
      );
    }

    const orderId = verification.orderId!;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { canteenId: true, studentId: true, status: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found", errorCode: "ORDER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (authContext.role === UserRole.MERCHANT_STAFF && order.canteenId !== authContext.canteenId) {
      return NextResponse.json(
        { success: false, error: "Cannot verify orders from other canteens", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (order.status !== OrderStatus.READY) {
      return NextResponse.json(
        { success: false, error: `Order is not ready for collection. Status: ${order.status}`, errorCode: "INVALID_STATUS" },
        { status: 400 }
      );
    }

    const orderContext = createOrderContext(authContext);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COLLECTED,
          collectedAt: new Date(),
          qrToken: null,
          qrExpiresAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: orderContext.actorId,
          actorRole: orderContext.actorRole,
          action: AuditAction.ORDER_COLLECTED,
          entityType: "Order",
          entityId: orderId,
          canteenId: order.canteenId,
          previousState: { status: OrderStatus.READY },
          newState: { status: OrderStatus.COLLECTED, collectedAt: new Date().toISOString() },
          metadata: { verifiedBy: authContext.id, method: "QR_SCAN" },
        },
      });

      return updated;
    });

    await invalidateQRToken(orderId, orderContext.actorId, orderContext.actorRole);
    await markQRTokenVerified(orderId, orderContext.actorId, orderContext.actorRole);

    return NextResponse.json({
      success: true,
      data: {
        message: "Order collected successfully",
        orderId,
        collectedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("QR verification error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}