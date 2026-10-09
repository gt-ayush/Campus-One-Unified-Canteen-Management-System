/**
 * SOURCE OF TRUTH KEYWORDS: api, merchants, settlement, payout, report, reconciliation, admin, merchant
 * WHAT: GET /api/v1/merchants/:id/settlement - Generate merchant settlement report with payout calculation
 * WHY: Provides T+1 daily settlement with Gross Sales - Platform Fees - Refund Adjustments = Net Payable
 * WHERE: src/app/api/v1/merchants/[id]/settlement/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { generateSettlementReport, createSettlementRecord, formatSettlementForExport } from "@/lib/settlement/settlement-service";
import { getAuthContext } from "@/lib/auth/server-auth";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = getAuthContext();
    const { id: canteenId } = await params;
    const { searchParams } = new URL(request.url);

    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");
    const format = searchParams.get("format") || "json";
    const action = searchParams.get("action");

    if (authContext.role === UserRole.MERCHANT_STAFF && authContext.canteenId !== canteenId) {
      return NextResponse.json(
        { success: false, error: "Cannot access other canteen's settlements", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    if (authContext.role === UserRole.STUDENT) {
      return NextResponse.json(
        { success: false, error: "Students cannot access settlement data", errorCode: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const now = new Date();
    const defaultPeriodEnd = periodEnd ? new Date(periodEnd) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const defaultPeriodStart = periodStart 
      ? new Date(periodStart) 
      : new Date(defaultPeriodEnd.getTime() - 24 * 60 * 60 * 1000);

    if (action === "calculate") {
      if (authContext.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { success: false, error: "Only admins can calculate settlements", errorCode: "FORBIDDEN" },
          { status: 403 }
        );
      }

      const settlementId = await createSettlementRecord(
        canteenId,
        defaultPeriodStart,
        defaultPeriodEnd,
        authContext.id
      );

      return NextResponse.json({
        success: true,
        data: { settlementId, message: "Settlement calculated successfully" },
      });
    }

    if (action === "payout") {
      if (authContext.role !== UserRole.ADMIN) {
        return NextResponse.json(
          { success: false, error: "Only admins can process payouts", errorCode: "FORBIDDEN" },
          { status: 403 }
        );
      }

      const settlementId = searchParams.get("settlementId");
      const payoutReference = searchParams.get("payoutReference");

      if (!settlementId || !payoutReference) {
        return NextResponse.json(
          { success: false, error: "settlementId and payoutReference required", errorCode: "VALIDATION_ERROR" },
          { status: 400 }
        );
      }

      await import("@/lib/settlement/settlement-service").then(({ markSettlementPaid }) =>
        markSettlementPaid(settlementId, authContext.id, payoutReference)
      );

      return NextResponse.json({
        success: true,
        data: { message: "Settlement marked as paid out" },
      });
    }

    const report = await generateSettlementReport(canteenId, defaultPeriodStart, defaultPeriodEnd);

    if (format === "csv") {
      const csv = formatSettlementForExport(report);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="settlement-${canteenId}-${defaultPeriodStart.toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    const existingSettlement = await prisma.settlement.findUnique({
      where: {
        canteenId_periodStart_periodEnd: {
          canteenId,
          periodStart: defaultPeriodStart,
          periodEnd: defaultPeriodEnd,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...report,
        existingSettlement: existingSettlement
          ? {
              id: existingSettlement.id,
              status: existingSettlement.status,
              calculatedAt: existingSettlement.calculatedAt,
              paidOutAt: existingSettlement.paidOutAt,
              payoutReference: existingSettlement.payoutReference,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Settlement report error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", errorCode: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}