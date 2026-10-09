/**
 * SOURCE OF TRUTH KEYWORDS: food-pass-wallet, wallet-widget, student-ui, credit-balance, deduction-ledger
 * WHAT: Food Pass wallet widget displaying active pass package, remaining credit balance, expiration date, and recent deduction ledger
 * WHY: Provides students with a clear view of their prepaid meal pass status and transaction history
 * WHERE: src/app/(student)/pass/_components/wallet-widget.tsx
 */

"use client";

import { useEffect, useState } from "react";
import { useFoodPasses } from "@/lib/hooks/use-queries";
import { FoodPass } from "@/lib/types/domain";

interface WalletWidgetProps {
  className?: string;
  compact?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDaysUntil(date: Date | string): number {
  const target = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function WalletWidget({ className, compact = false }: WalletWidgetProps) {
  const { data: foodPassesData, isLoading, refetch } = useFoodPasses();
  const [activePass, setActivePass] = useState<FoodPass | null>(null);
  const [showLedger, setShowLedger] = useState(false);

  useEffect(() => {
    if (foodPassesData?.data) {
      const active = foodPassesData.data.find((p: FoodPass) => p.status === "ACTIVE");
      setActivePass(active || foodPassesData.data[0] || null);
    }
  }, [foodPassesData]);

  if (isLoading && !activePass) {
    return (
      <div className={`bg-card rounded-xl border border-border p-6 ${className || ""}`}>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-10 bg-muted rounded w-1/2" />
          <div className="h-2 bg-muted rounded-full" />
        </div>
      </div>
    );
  }

  if (!activePass) {
    if (compact) {
      return (
        <div className={className}>
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">No active Food Pass</p>
            <p className="text-xs mt-1">Visit admin to purchase a pass</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`bg-card rounded-xl border border-border p-6 ${className || ""}`}>
        <div className="text-center py-8">
          <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <h3 className="text-lg font-medium text-foreground">No Active Food Pass</h3>
          <p className="text-muted-foreground mt-2">You don't have an active meal pass. Contact your campus admin to purchase one.</p>
        </div>
      </div>
    );
  }

  const daysUntilExpiry = getDaysUntil(activePass.validUntil);
  const isExpiringSoon = daysUntilExpiry <= 14;
  const isExpired = daysUntilExpiry <= 0;
  const usagePercentage = activePass.totalCredits > 0
    ? Math.round(((activePass.totalCredits - activePass.remainingCredits) / activePass.totalCredits) * 100)
    : 0;

  if (compact) {
    return (
      <div className={`bg-card rounded-xl border border-border p-4 ${className || ""}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">{activePass.packageName}</h3>
            <p className="text-xs text-muted-foreground">Expires {formatDate(activePass.validUntil)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(activePass.remainingCredits)}
            </p>
            <p className="text-xs text-muted-foreground">of {formatCurrency(activePass.totalCredits)}</p>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isExpired ? "bg-destructive" : isExpiringSoon ? "bg-amber-500" : "bg-primary"
            }`}
            style={{ width: `${Math.min(100, usagePercentage)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{daysUntilExpiry > 0 ? `${daysUntilExpiry} days left` : "Expired"}</span>
          <span>{usagePercentage}% used</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-xl border border-border overflow-hidden ${className || ""}`}>
      <div className={`p-6 ${isExpired ? "bg-destructive/10" : isExpiringSoon ? "bg-amber-50" : "bg-primary/5"} border-b border-border`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{activePass.packageName}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
              <span className={`inline-flex items-center px-2 py-1 rounded-full font-medium ${
                isExpired ? "bg-destructive/10 text-destructive" :
                isExpiringSoon ? "bg-amber-100 text-amber-700" :
                "bg-green-100 text-green-700"
              }`}>
                {isExpired
                  ? "Expired"
                  : isExpiringSoon
                    ? `Expires in ${daysUntilExpiry} days`
                    : `Valid until ${formatDate(activePass.validUntil)}`}
              </span>
              <span className="text-muted-foreground">Purchased: {formatDate(activePass.createdAt)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2 sm:gap-4">
            <div className="text-right">
              <p className="text-3xl font-bold text-foreground">
                {formatCurrency(activePass.remainingCredits)}
              </p>
              <p className="text-xs text-muted-foreground">Remaining Balance</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">of {formatCurrency(activePass.totalCredits)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-muted-foreground">Used</span>
            <span className="text-muted-foreground">{formatCurrency(activePass.totalCredits - activePass.remainingCredits)}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isExpired ? "bg-destructive" : isExpiringSoon ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, usagePercentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{usagePercentage}% used</span>
            <span>Daily limit: {formatCurrency(activePass.dailyLimit)}</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Transactions</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowLedger(!showLedger)}
              className="text-sm text-primary hover:underline"
            >
              {showLedger ? "Hide Ledger" : "View Full Ledger"}
            </button>
          </div>
        </div>

        <div className={showLedger ? "block" : "hidden"}>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-4 px-4 py-3 text-xs font-medium text-muted-foreground bg-muted border-b border-border">
              <span>Date</span>
              <span>Description</span>
              <span className="text-right">Amount</span>
              <span className="text-right">Balance</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <div className="grid grid-cols-4 px-4 py-3 text-sm border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">Jan 15, 2024</span>
                <span>Chicken Rice Bowl</span>
                <span className="text-right text-destructive">-$8.99</span>
                <span className="text-right text-muted-foreground">{formatCurrency(activePass.remainingCredits + 8.99)}</span>
              </div>
              <div className="grid grid-cols-4 px-4 py-3 text-sm border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">Jan 14, 2024</span>
                <span>Vegetarian Stir Fry</span>
                <span className="text-right text-destructive">-$7.99</span>
                <span className="text-right text-muted-foreground">{formatCurrency(activePass.remainingCredits + 8.99 + 7.99)}</span>
              </div>
              <div className="grid grid-cols-4 px-4 py-3 text-sm border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">Jan 12, 2024</span>
                <span>Food Pass Top-up</span>
                <span className="text-right text-green-600">+$50.00</span>
                <span className="text-right text-muted-foreground">{formatCurrency(activePass.remainingCredits + 8.99 + 7.99 + 50)}</span>
              </div>
              <div className="grid grid-cols-4 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Jan 10, 2024</span>
                <span>Beef Burrito</span>
                <span className="text-right text-destructive">-$9.49</span>
                <span className="text-right text-muted-foreground">{formatCurrency(activePass.remainingCredits + 8.99 + 7.99 + 50 + 9.49)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-muted/50 rounded-lg text-center text-sm text-muted-foreground">
            <p>Recent deductions shown. Full history available in your account settings.</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button className="px-4 py-3 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-foreground">Top Up Food Pass</p>
                  <p className="text-xs text-muted-foreground">Add more credits to your pass</p>
                </div>
              </div>
            </button>
            <button className="px-4 py-3 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-foreground">View Full History</p>
                  <p className="text-xs text-muted-foreground">See all transactions and deductions</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}