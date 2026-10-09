/**
 * SOURCE OF TRUTH KEYWORDS: settlement-reconciliation, admin-ui, financial-ledger, payout-summary
 * WHAT: Admin settlement reconciliation summary with comprehensive ledger table displaying Gross Sales, Platform Fees, Refund Adjustments, and Net Payable
 * WHY: Provides administrators with a comprehensive view of merchant settlements and financial reconciliation
 * WHERE: src/app/(admin)/settlements/_components/settlement-summary.tsx
 */

"use client";

import { useState, useEffect } from "react";
import { SettlementStatus } from "@/lib/types/domain";

interface SettlementSummaryProps {
  className?: string;
}

interface Settlement {
  id: string;
  canteenId: string;
  canteenName: string;
  periodStart: string;
  periodEnd: string;
  grossSales: number;
  platformFees: number;
  refundAdjustments: number;
  netPayable: number;
  status: SettlementStatus;
  calculatedAt: string;
  paidOutAt?: string;
  paidOutBy?: string;
  payoutReference?: string;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3 mb-2" />
            <div className="h-8 bg-muted rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/4 mb-4" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-4 bg-muted rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 012-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <h3 className="text-lg font-medium text-foreground mb-1">No Settlements Found</h3>
      <p className="text-muted-foreground">No settlement records match your filters</p>
    </div>
  );
}

export function SettlementSummary({ className }: SettlementSummaryProps) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCanteenId, setSelectedCanteenId] = useState<string>("all");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [calculating, setCalculating] = useState<string | null>(null);
  const [payoutLoading, setPayoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettlements();
  }, [selectedCanteenId, periodStart, periodEnd]);

  const fetchSettlements = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCanteenId !== "all") params.append("canteenId", selectedCanteenId);
      if (periodStart) params.append("periodStart", periodStart);
      if (periodEnd) params.append("periodEnd", periodEnd);

      const response = await fetch(`/api/v1/settlements?${params}`);
      const data = await response.json();
      if (data.success) {
        setSettlements(data.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch settlements");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculate = async (canteenId: string) => {
    if (!periodStart || !periodEnd) {
      setError("Please select period start and end dates");
      return;
    }
    setCalculating(canteenId);
    try {
      await fetch(`/api/v1/merchants/${canteenId}/settlement?action=calculate&periodStart=${periodStart}&periodEnd=${periodEnd}`, {
        method: "GET",
      });
      fetchSettlements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate settlement");
    } finally {
      setCalculating(null);
    }
  };

  const handlePayout = async (settlementId: string, payoutReference: string) => {
    setPayoutLoading(settlementId);
    try {
      await fetch(`/api/v1/merchants/settlement?action=payout&settlementId=${settlementId}&payoutReference=${payoutReference}`, {
        method: "GET",
      });
      fetchSettlements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process payout");
    } finally {
      setPayoutLoading(null);
    }
  };

  const handleDownloadCSV = () => {
    const csv = settlements.map(s => ({
      "Canteen": s.canteenName,
      "Period Start": s.periodStart,
      "Period End": s.periodEnd,
      "Gross Sales": s.grossSales,
      "Platform Fees": s.platformFees,
      "Refund Adjustments": s.refundAdjustments,
      "Net Payable": s.netPayable,
      "Status": s.status,
      "Calculated At": s.calculatedAt,
      "Paid Out At": s.paidOutAt || "",
      "Payout Reference": s.payoutReference || "",
    }));
    const headers = Object.keys(csv[0] || {}).join(",");
    const rows = csv.map(r => Object.values(r).join(",")).join("\n");
    const csvContent = headers + "\n" + rows;
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settlements-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalGrossSales = settlements.reduce((sum, s) => sum + s.grossSales, 0);
  const totalPlatformFees = settlements.reduce((sum, s) => sum + s.platformFees, 0);
  const totalRefundAdjustments = settlements.reduce((sum, s) => sum + s.refundAdjustments, 0);
  const totalNetPayable = settlements.reduce((sum, s) => sum + s.netPayable, 0);

  const canteenOptions = [...new Map(settlements.map((s) => [s.canteenId, s.canteenName])).entries()];

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (settlements.length === 0) {
    return (
      <div className={className}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Settlement Reconciliation</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive ledger with Gross Sales, Platform Fees, Refund Adjustments, and Net Payable
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownloadCSV}
            disabled={settlements.length === 0}
            className="px-4 py-2 text-sm font-medium text-foreground bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download CSV
          </button>
          <button
            onClick={() => {
              if (selectedCanteenId !== "all") {
                handleCalculate(selectedCanteenId);
              } else {
                setError("Select a specific canteen to calculate its settlement");
              }
            }}
            disabled={calculating !== null}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {calculating !== null ? "Calculating..." : "Calculate Settlement"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-destructive hover:underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Gross Sales</p>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalGrossSales)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Platform Fees</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totalPlatformFees)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Refund Adjustments</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(totalRefundAdjustments)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Net Payable</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalNetPayable)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedCanteenId}
            onChange={e => setSelectedCanteenId(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filter by canteen"
          >
            <option value="all">All Canteens</option>
            {canteenOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <select
            value={periodStart}
            onChange={e => setPeriodStart(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Period Start</option>
            {generateDateOptions().map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={periodEnd}
            onChange={e => setPeriodEnd(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Period End</option>
            {generateDateOptions().map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {settlements.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Canteen</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Period</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Gross Sales</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Platform Fees</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Refund Adj.</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Net Payable</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Calculated</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {settlements.map(settlement => (
                  <tr key={settlement.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-3">
                      <p className="font-medium text-foreground">{settlement.canteenName}</p>
                      <p className="text-xs text-muted-foreground">ID: {settlement.canteenId.slice(0, 8)}...</p>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(settlement.periodStart)} - {formatDate(settlement.periodEnd)}
                    </td>
                    <td className="p-3 text-right font-medium text-foreground">
                      {formatCurrency(settlement.grossSales)}
                    </td>
                    <td className="p-3 text-right text-sm text-muted-foreground">
                      {formatCurrency(settlement.platformFees)}
                    </td>
                    <td className="p-3 text-right text-sm text-amber-600">
                      {formatCurrency(settlement.refundAdjustments)}
                    </td>
                    <td className="p-3 text-right font-semibold text-green-600">
                      {formatCurrency(settlement.netPayable)}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(settlement.status)}`}>
                        {settlement.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatDate(settlement.calculatedAt)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {settlement.status === SettlementStatus.CALCULATED && (
                          <button
                            onClick={() => {
                              const ref = prompt("Enter payout reference:");
                              if (ref) handlePayout(settlement.id, ref);
                            }}
                            disabled={payoutLoading === settlement.id}
                            className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 border border-green-200 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                          >
                            {payoutLoading === settlement.id ? "Processing..." : "Payout"}
                          </button>
                        )}
                        {settlement.status === SettlementStatus.PAID_OUT && (
                          <span className="text-xs text-muted-foreground">
                            Paid: {settlement.payoutReference}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusColor(status: string): string {
  switch (status) {
    case "CALCULATED": return "bg-blue-100 text-blue-700";
    case "PAID_OUT": return "bg-green-100 text-green-700";
    case "PENDING": return "bg-amber-100 text-amber-700";
    case "DISPUTED": return "bg-red-100 text-red-700";
    default: return "bg-muted text-muted-foreground";
  }
}

function generateDateOptions(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    dates.push(date.toISOString().split("T")[0] ?? "");
  }
  return dates;
}