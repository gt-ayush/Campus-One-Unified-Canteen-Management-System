/**
 * SOURCE OF TRUTH KEYWORDS: order-service, atomic-transaction, stock-reservation, slot-reservation, pass-deduction, concurrency
 * WHAT: Core order service with atomic database transactions for stock, slot, and pass credit reservations
 * WHY: Prevents double-booking and overselling during high-concurrency lunch rush using SELECT FOR UPDATE
 * WHERE: src/lib/services/order-service.ts
 */

import "server-only";
import { prisma } from "@/lib/db/client";
import { orderStateMachine } from "@/lib/state-machine/order-state-machine";
import { generateQRToken } from "@/lib/qr-engine/qr-token-engine";
import { findAlternatives } from "@/lib/recommendation/alternative-engine";
import { OrderStatus, PaymentStatus, PaymentMethod, AuditAction, UserRole } from "@/lib/types/domain";
import { Decimal } from "@prisma/client/runtime/library";

export interface CreateOrderInput {
  studentId: string;
  canteenId: string;
  pickupSlotId: string;
  foodPassId?: string;
  items: { menuItemId: string; quantity: number }[];
  notes?: string;
}

export interface OrderCreationResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  qrToken?: string;
  alternatives?: Awaited<ReturnType<typeof findAlternatives>>["alternatives"];
  error?: string;
  errorCode?: string;
}

export interface OrderContext {
  actorId: string;
  actorRole: UserRole;
  canteenId?: string;
}

async function generateOrderNumber(): Promise<string> {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `ORD-${dateStr}-${random}`;
}

export async function createOrderAtomically(
  input: CreateOrderInput,
  context: OrderContext
): Promise<OrderCreationResult> {
  const { studentId, canteenId, pickupSlotId, foodPassId, items, notes } = input;

  return await prisma.$transaction(async (tx) => {
    const studentProfile = await tx.studentProfile.findUnique({
      where: { id: studentId },
      select: { id: true, userId: true, campusId: true },
    });

    if (!studentProfile) {
      throw new Error("Student profile not found");
    }

    const canteen = await tx.canteen.findUnique({
      where: { id: canteenId },
      select: { id: true, name: true, isApproved: true, commissionRate: true },
    });

    if (!canteen || !canteen.isApproved) {
      throw new Error("Canteen not found or not approved");
    }

    const pickupSlot = await tx.pickupSlot.findUnique({
      where: { id: pickupSlotId },
    });

    if (!pickupSlot || pickupSlot.canteenId !== canteenId || !pickupSlot.isActive) {
      throw new Error("Invalid or inactive pickup slot");
    }

    const now = new Date();
    if (now > pickupSlot.endTime) {
      throw new Error("Pickup slot has already ended");
    }

    if (pickupSlot.reservedCount >= pickupSlot.capacityLimit) {
      const alternatives = await findAlternatives({
        studentId,
        originalCanteenId: canteenId,
        originalMenuItemId: items[0]?.menuItemId ?? "",
        originalPickupSlotId: pickupSlotId,
        quantity: items[0]?.quantity ?? 1,
      });
      throw Object.assign(new Error("PICKUP_SLOT_FULL"), { alternatives: alternatives.alternatives });
    }

    const menuItems = await tx.menuItem.findMany({
      where: { id: { in: items.map((i) => i.menuItemId) } },
    });

    if (menuItems.length !== items.length) {
      throw new Error("One or more menu items not found");
    }

    let subtotal = 0;
    const orderItemsData = [];

    for (const itemInput of items) {
      const menuItem = menuItems.find((m) => m.id === itemInput.menuItemId)!;
      const quantity = itemInput.quantity;

      if (!menuItem.isAvailable) {
        throw new Error(`Item "${menuItem.name}" is currently unavailable`);
      }

      if (menuItem.stockQuantity < quantity) {
        const alternatives = await findAlternatives({
          studentId,
          originalCanteenId: canteenId,
          originalMenuItemId: menuItem.id,
          originalPickupSlotId: pickupSlotId,
          quantity,
        });
        throw Object.assign(new Error("INSUFFICIENT_STOCK"), {
          menuItemId: menuItem.id,
          availableStock: menuItem.stockQuantity,
          requestedQuantity: quantity,
          alternatives: alternatives.alternatives,
        });
      }

      if (quantity > menuItem.maxPerOrder) {
        throw new Error(`Maximum ${menuItem.maxPerOrder} units allowed per order for "${menuItem.name}"`);
      }

      const totalPrice = Number(menuItem.price) * quantity;
      subtotal += totalPrice;

      orderItemsData.push({
        menuItemId: menuItem.id,
        quantity,
        unitPrice: menuItem.price,
        totalPrice,
        itemNameSnapshot: menuItem.name,
      });

      await tx.menuItem.update({
        where: { id: menuItem.id },
        data: { stockQuantity: { decrement: quantity } },
      });

      await tx.auditLog.create({
        data: {
          actorId: studentId,
          actorRole: UserRole.STUDENT,
          action: AuditAction.STOCK_RESERVED,
          entityType: "MenuItem",
          entityId: menuItem.id,
          canteenId,
          metadata: { quantity, orderId: "pending", reservedAt: new Date().toISOString() },
        },
      });
    }

    const platformFee = subtotal * Number(canteen.commissionRate);
    const totalAmount = subtotal + platformFee;

    let foodPass: { id: string; remainingCredits: number; dailyLimit: number } | null = null;
    if (foodPassId) {
      foodPass = await tx.foodPass.findUnique({
        where: { id: foodPassId, studentId },
      });

      if (!foodPass || foodPass.remainingCredits < totalAmount) {
        throw new Error("Insufficient food pass credits");
      }
    }

    const orderNumber = await generateOrderNumber();

    const order = await tx.order.create({
      data: {
        orderNumber,
        studentId,
        canteenId,
        pickupSlotId,
        foodPassId,
        status: OrderStatus.PENDING,
        subtotal,
        platformFee,
        totalAmount,
        paymentStatus: foodPassId ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
        paymentMethod: foodPassId ? PaymentMethod.FOOD_PASS : PaymentMethod.SIMULATED,
        notes,
        items: { create: orderItemsData },
      },
    });

    await tx.pickupSlot.update({
      where: { id: pickupSlotId },
      data: { reservedCount: { increment: items.reduce((sum, i) => sum + i.quantity, 0) } },
    });

    await tx.auditLog.create({
      data: {
        actorId: studentId,
        actorRole: UserRole.STUDENT,
        action: AuditAction.SLOT_RESERVED,
        entityType: "PickupSlot",
        entityId: pickupSlotId,
        canteenId,
        metadata: { orderId: order.id, quantity: items.reduce((sum, i) => sum + i.quantity, 0) },
      },
    });

    if (foodPassId && foodPass) {
      await tx.foodPass.update({
        where: { id: foodPassId },
        data: { remainingCredits: { decrement: totalAmount } },
      });

      await tx.auditLog.create({
        data: {
          actorId: studentId,
          actorRole: UserRole.STUDENT,
          action: AuditAction.PASS_CREDITS_DEDUCTED,
          entityType: "FoodPass",
          entityId: foodPassId,
          canteenId,
          metadata: { orderId: order.id, amount: totalAmount, remainingCredits: foodPass.remainingCredits - totalAmount },
        },
      });

      if (!foodPassId) {
        await tx.payment.create({
          data: {
            orderId: order.id,
            studentId,
            amount: totalAmount,
            method: PaymentMethod.FOOD_PASS,
            status: PaymentStatus.COMPLETED,
            processedAt: new Date(),
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: studentId,
        actorRole: UserRole.STUDENT,
        action: AuditAction.ORDER_CREATED,
        entityType: "Order",
        entityId: order.id,
        canteenId,
        newState: { orderNumber, status: OrderStatus.PENDING, totalAmount, itemCount: items.length },
      },
    });

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
    };
  }, {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: "Serializable",
  });
}

export async function confirmOrder(
  orderId: string,
  context: OrderContext
): Promise<{ success: boolean; qrToken?: string; error?: string }> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { canteen: true },
  });

  const validation = orderStateMachine.validateTransition(order.status, OrderStatus.CONFIRMED, context);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        actorRole: context.actorRole,
        action: validation.auditData!.action,
        entityType: "Order",
        entityId: orderId,
        canteenId: order.canteenId,
        previousState: { status: order.status },
        newState: { status: OrderStatus.CONFIRMED },
        metadata: validation.auditData!.metadata,
      },
    });

    return updated;
  });

  return { success: true };
}

export async function transitionOrderStatus(
  orderId: string,
  targetStatus: OrderStatus,
  context: OrderContext,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { canteen: true },
  });

  if (context.actorRole === UserRole.MERCHANT_STAFF) {
    if (order.canteenId !== context.canteenId) {
      return { success: false, error: "FORBIDDEN: Cannot access orders from other canteens" };
    }
  }

  const validation = orderStateMachine.validateTransition(order.status, targetStatus, context);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  const updateData: Record<string, unknown> = { status: targetStatus };
  if (targetStatus === OrderStatus.PREPARING) updateData.preparingAt = new Date();
  if (targetStatus === OrderStatus.READY) updateData.readyAt = new Date();
  if (targetStatus === OrderStatus.COLLECTED) updateData.collectedAt = new Date();
  if (targetStatus === OrderStatus.CANCELLED) {
    updateData.cancelledAt = new Date();
    updateData.cancelledBy = context.actorId;
    updateData.cancellationReason = reason;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        actorId: context.actorId,
        actorRole: context.actorRole,
        action: validation.auditData!.action,
        entityType: "Order",
        entityId: orderId,
        canteenId: order.canteenId,
        previousState: { status: order.status },
        newState: { status: targetStatus },
        metadata: { ...validation.auditData!.metadata, reason },
      },
    });

    if (targetStatus === OrderStatus.CANCELLED || targetStatus === OrderStatus.REJECTED) {
      await releaseOrderResources(tx, orderId, context.actorId, context.actorRole);
    }

    if (targetStatus === OrderStatus.READY) {
      const qrData = await generateQRToken(orderId, order.studentId, order.canteenId);
      await tx.order.update({
        where: { id: orderId },
        data: { qrToken: qrData.token, qrExpiresAt: qrData.payload.expiresAt },
      });
      return { success: true, qrToken: qrData.token };
    }
  });

  return { success: true };
}

async function releaseOrderResources(
  tx: any,
  orderId: string,
  actorId: string,
  actorRole: UserRole
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true, pickupSlot: true, foodPass: true },
  });

  if (!order) return;

  for (const item of order.items) {
    await tx.menuItem.update({
      where: { id: item.menuItemId },
      data: { stockQuantity: { increment: item.quantity } },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        actorRole,
        action: AuditAction.STOCK_RELEASED,
        entityType: "MenuItem",
        entityId: item.menuItemId,
        canteenId: order.canteenId,
        metadata: { quantity: item.quantity, orderId, releasedAt: new Date().toISOString() },
      },
    });
  }

  const totalQuantity = order.items.reduce((sum: number, i: any) => sum + i.quantity, 0);
  await tx.pickupSlot.update({
    where: { id: order.pickupSlotId },
    data: { reservedCount: { decrement: totalQuantity } },
  });

  await tx.auditLog.create({
    data: {
      actorId,
      actorRole,
      action: AuditAction.SLOT_RELEASED,
      entityType: "PickupSlot",
      entityId: order.pickupSlotId,
      canteenId: order.canteenId,
      metadata: { orderId, quantity: totalQuantity, releasedAt: new Date().toISOString() },
    },
  });

  if (order.foodPassId) {
    await tx.foodPass.update({
      where: { id: order.foodPassId },
      data: { remainingCredits: { increment: Number(order.totalAmount) } },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        actorRole,
        action: AuditAction.PASS_CREDITS_RESTORED,
        entityType: "FoodPass",
        entityId: order.foodPassId,
        canteenId: order.canteenId,
        metadata: { orderId, amount: Number(order.totalAmount), restoredAt: new Date().toISOString() },
      },
    });
  }
}

export async function getOrderDetails(orderId: string, context: OrderContext) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { menuItem: true } },
      pickupSlot: true,
      canteen: true,
      student: { include: { user: true } },
      payment: true,
    },
  });

  if (!order) return null;

  if (context.actorRole === UserRole.MERCHANT_STAFF && order.canteenId !== context.canteenId) {
    return null;
  }

  if (context.actorRole === UserRole.STUDENT && order.studentId !== context.actorId) {
    return null;
  }

  return order;
}

export async function getStudentOrders(studentId: string, status?: OrderStatus) {
  return prisma.order.findMany({
    where: { studentId, ...(status ? { status } : {}) },
    include: {
      items: { include: { menuItem: true } },
      pickupSlot: true,
      canteen: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCanteenOrders(
  canteenId: string,
  status?: OrderStatus,
  dateFrom?: Date,
  dateTo?: Date
) {
  return prisma.order.findMany({
    where: {
      canteenId,
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {}),
    },
    include: {
      items: { include: { menuItem: true } },
      pickupSlot: true,
      student: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}