/**
 * SOURCE OF TRUTH KEYWORDS: admin-settlements, settlement-reconciliation, admin-ui, financial-ledger
 * WHAT: Admin settlements page with comprehensive reconciliation summary and payout management
 * WHY: Provides administrators with a comprehensive view of merchant settlements and financial reconciliation
 * WHERE: src/app/(admin)/settlements/page.tsx
 */

"use client";

import { SettlementSummary } from "./_components/settlement-summary";

export default function AdminSettlementsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Settlement Reconciliation</h1>
              <p className="text-muted-foreground text-sm">Comprehensive ledger with Gross Sales, Platform Fees, Refund Adjustments, and Net Payable</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <SettlementSummary />
      </main>
    </div>
  );
}