/**
 * SOURCE OF TRUTH KEYWORDS: settlement, merchant, payout, commission, reconciliation, daily, ledger
 * WHAT: Merchant settlement calculation service with T+1 daily reconciliation and commission tracking
 * WHY: Calculates Net Payable = Gross Sales - Platform Fees - Refund Adjustments with audit trail
 * WHERE: src/lib/settlement/settlement-service.ts
 */

import "server-only";
import { prisma } from "@/lib/db/client";
import { SettlementStatus, PaymentStatus, OrderStatus, AuditAction, UserRole } from "@prisma/client";

export interface SettlementCalculation {
  grossSales: number;
  platformFees: number;
  refundAdjustments: number;
  netPayable: number;
  orderCount: number;
  collectedOrderCount: number;
  refundedOrderCount: number;
}

export interface SettlementReport {
  canteenId: string;
  canteenName: string;
  periodStart: Date;
  periodEnd: Date;
  calculation: SettlementCalculation;
  orders: SettlementOrderDetail[];
  refunds: SettlementRefundDetail[];
}

export interface SettlementOrderDetail {
  orderId: string;
  orderNumber: string;
  orderDate: Date;
  collectedAt: Date | null;
  subtotal: number;
  platformFee: number;
  status: OrderStatus;
}

export interface SettlementRefundDetail {
  orderId: string;
  orderNumber: string;
  refundDate: Date;
  refundAmount: number;
  refundReason: string | null;
}

export async function calculateDailySettlement(
  canteenId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<SettlementCalculation> {
  const orders = await prisma.order.findMany({
    where: {
      canteenId,
      createdAt: {
        gte: periodStart,
        lt: periodEnd,
      },
      status: {
        in: [OrderStatus.COLLECTED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
      },
    },
    include: {
      payment: true,
      items: true,
    },
  });

  let grossSales = 0;
  let platformFees = 0;
  let refundAdjustments = 0;
  let collectedOrderCount = 0;
  let refundedOrderCount = 0;

  const canteen = await prisma.canteen.findUnique({
    where: { id: canteenId },
    select: { commissionRate: true },
  });

  const commissionRate = canteen?.commissionRate ?? 0.10;

  for (const order of orders) {
    const orderTotal = Number(order.totalAmount);
    const platformFee = Number(order.platformFee) || orderTotal * Number(commissionRate);

    if (order.status === OrderStatus.COLLECTED && order.paymentStatus === PaymentStatus.COMPLETED) {
      grossSales += orderTotal;
      platformFees += platformFee;
      collectedOrderCount++;
    }

    if (
      (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REJECTED) &&
      order.paymentStatus === PaymentStatus.REFUNDED
    ) {
      const refundAmount = order.payment?.refundAmount ? Number(order.payment.refundAmount) : 0;
      refundAdjustments += refundAmount;
      refundedOrderCount++;
    }
  }

  const netPayable = grossSales - platformFees - refundAdjustments;

  return {
    grossSales,
    platformFees,
    refundAdjustments,
    netPayable: Math.max(0, netPayable),
    orderCount: orders.length,
    collectedOrderCount,
    refundedOrderCount,
  };
}

export async function generateSettlementReport(
  canteenId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<SettlementReport> {
  const canteen = await prisma.canteen.findUniqueOrThrow({
    where: { id: canteenId },
    select: { id: true, name: true },
  });

  const calculation = await calculateDailySettlement(canteenId, periodStart, periodEnd);

  const orders = await prisma.order.findMany({
    where: {
      canteenId,
      createdAt: { gte: periodStart, lt: periodEnd },
    },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      collectedAt: true,
      subtotal: true,
      platformFee: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const refunds = await prisma.payment.findMany({
    where: {
      order: { canteenId },
      refundedAt: { gte: periodStart, lt: periodEnd },
      refundAmount: { gt: 0 },
    },
    include: { order: { select: { orderNumber: true } } },
    orderBy: { refundedAt: "desc" },
  });

  return {
    canteenId: canteen.id,
    canteenName: canteen.name,
    periodStart,
    periodEnd,
    calculation,
    orders: orders.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      orderDate: o.createdAt,
      collectedAt: o.collectedAt,
      subtotal: Number(o.subtotal),
      platformFee: Number(o.platformFee),
      status: o.status,
    })),
    refunds: refunds.map((r) => ({
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      refundDate: r.refundedAt!,
      refundAmount: Number(r.refundAmount),
      refundReason: r.refundReason,
    })),
  };
}

export async function createSettlementRecord(
  canteenId: string,
  periodStart: Date,
  periodEnd: Date,
  calculatedBy: string
): Promise<string> {
  const calculation = await calculateDailySettlement(canteenId, periodStart, periodEnd);

  const existing = await prisma.settlement.findUnique({
    where: {
      canteenId_periodStart_periodEnd: { canteenId, periodStart, periodEnd },
    },
  });

  if (existing) {
    if (existing.status !== SettlementStatus.PENDING) {
      throw new Error("Settlement already processed for this period");
    }
    await prisma.settlement.update({
      where: { id: existing.id },
      data: {
        grossSales: calculation.grossSales,
        platformFees: calculation.platformFees,
        refundAdjustments: calculation.refundAdjustments,
        netPayable: calculation.netPayable,
        status: SettlementStatus.CALCULATED,
        calculatedAt: new Date(),
      },
    });
    return existing.id;
  }

  const settlement = await prisma.settlement.create({
    data: {
      canteenId,
      periodStart,
      periodEnd,
      grossSales: calculation.grossSales,
      platformFees: calculation.platformFees,
      refundAdjustments: calculation.refundAdjustments,
      netPayable: calculation.netPayable,
      status: SettlementStatus.CALCULATED,
      calculatedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: calculatedBy,
      actorRole: UserRole.ADMIN,
      action: AuditAction.SETTLEMENT_CALCULATED,
      entityType: "Settlement",
      entityId: settlement.id,
      canteenId,
      newState: {
        grossSales: calculation.grossSales,
        platformFees: calculation.platformFees,
        refundAdjustments: calculation.refundAdjustments,
        netPayable: calculation.netPayable,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    },
  });

  return settlement.id;
}

export async function markSettlementPaid(
  settlementId: string,
  paidOutBy: string,
  payoutReference: string
): Promise<void> {
  const settlement = await prisma.settlement.findUniqueOrThrow({
    where: { id: settlementId },
  });

  if (settlement.status === SettlementStatus.PAID_OUT) {
    throw new Error("Settlement already paid out");
  }

  await prisma.settlement.update({
    where: { id: settlementId },
    data: {
      status: SettlementStatus.PAID_OUT,
      paidOutAt: new Date(),
      paidOutBy,
      payoutReference,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: paidOutBy,
      actorRole: UserRole.ADMIN,
      action: AuditAction.SETTLEMENT_PAID,
      entityType: "Settlement",
      entityId: settlementId,
      canteenId: settlement.canteenId,
      previousState: { status: settlement.status },
      newState: {
        status: SettlementStatus.PAID_OUT,
        paidOutAt: new Date().toISOString(),
        payoutReference,
      },
    },
  });
}

export async function getSettlementHistory(
  canteenId: string,
  limit = 20,
  offset = 0
) {
  return prisma.settlement.findMany({
    where: { canteenId },
    orderBy: { periodStart: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function getPendingSettlements(): Promise<string[]> {
  const settlements = await prisma.settlement.findMany({
    where: { status: SettlementStatus.CALCULATED },
    select: { id: true },
  });
  return settlements.map((s) => s.id);
}

export function formatSettlementForExport(report: SettlementReport): string {
  const lines = [
    `MERCHANT SETTLEMENT REPORT`,
    `Canteen: ${report.canteenName} (${report.canteenId})`,
    `Period: ${report.periodStart.toISOString().split("T")[0]} to ${report.periodEnd.toISOString().split("T")[0]}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `SUMMARY`,
    `Gross Sales: ${report.calculation.grossSales.toFixed(2)}`,
    `Platform Fees: ${report.calculation.platformFees.toFixed(2)}`,
    `Refund Adjustments: ${report.calculation.refundAdjustments.toFixed(2)}`,
    `Net Payable: ${report.calculation.netPayable.toFixed(2)}`,
    `Total Orders: ${report.calculation.orderCount}`,
    `Collected Orders: ${report.calculation.collectedOrderCount}`,
    `Refunded Orders: ${report.calculation.refundedOrderCount}`,
    ``,
    `ORDER DETAILS`,
    `Order ID,Order Number,Order Date,Collected At,Subtotal,Platform Fee,Status`,
    ...report.orders.map(
      (o) =>
        `${o.orderId},${o.orderNumber},${o.orderDate.toISOString()},${o.collectedAt?.toISOString() ?? ""},${o.subtotal.toFixed(2)},${o.platformFee.toFixed(2)},${o.status}`
    ),
    ``,
    `REFUND DETAILS`,
    `Order ID,Order Number,Refund Date,Refund Amount,Reason`,
    ...report.refunds.map(
      (r) => `${r.orderId},${r.orderNumber},${r.refundDate.toISOString()},${r.refundAmount.toFixed(2)},${r.refundReason ?? ""}`
    ),
  ];
  return lines.join("\n");
}