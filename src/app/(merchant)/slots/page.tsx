/**
 * SOURCE OF TRUTH KEYWORDS: merchant-slots, pickup-slots, capacity-management, merchant-ui
 * WHAT: Merchant slots page with capacity management for pickup time windows
 * WHY: Provides merchants with a comprehensive interface to manage pickup time slots and capacity limits
 * WHERE: src/app/(merchant)/slots/page.tsx
 */

"use client";

import { CapacityManager } from "./_components/capacity-manager";

export default function SlotsPage() {
  // In production, this would come from auth context
  const canteenId = "demo-canteen-id";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pickup Slots</h1>
              <p className="text-muted-foreground text-sm">Manage pickup time windows and capacity limits</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <CapacityManager canteenId={canteenId} />
      </main>
    </div>
  );
}