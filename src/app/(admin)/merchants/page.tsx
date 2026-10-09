/**
 * SOURCE OF TRUTH KEYWORDS: admin-merchants, merchant-approval, admin-ui
 * WHAT: Admin merchants page with approval queue for reviewing and approving merchant registrations
 * WHY: Provides administrators with a comprehensive interface to review and approve/reject merchant registrations
 * WHERE: src/app/(admin)/merchants/page.tsx
 */

"use client";

import { ApprovalQueue } from "./_components/approval-queue";

export default function AdminMerchantsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Merchant Management</h1>
              <p className="text-muted-foreground text-sm">Review and approve merchant registrations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <ApprovalQueue />
      </main>
    </div>
  );
}