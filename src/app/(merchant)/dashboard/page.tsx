/**
 * SOURCE OF TRUTH KEYWORDS: merchant-orders, order-management, kanban-board, real-time
 * WHAT: Merchant orders page with real-time kanban board for order management
 * WHY: Provides merchants with a comprehensive dashboard to view and manage all incoming orders
 * WHERE: src/app/(merchant)/orders/page.tsx
 */

"use client";

import { useEffect, useState } from "react";
import { OrderBoard } from "./_components/order-board";

export default function MerchantOrdersPage() {
  const [canteenId, setCanteenId] = useState<string>("");

  // In a real app, this would come from auth context
  useEffect(() => {
    // For demo, we'll use a placeholder canteen ID
    // In production, this would come from the merchant's auth context
    setCanteenId("demo-canteen-id");
  }, []);

  if (!canteenId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Loading merchant dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-full mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Order Management</h1>
              <p className="text-muted-foreground text-sm">Real-time order management board</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 text-sm font-medium bg-green-100 text-green-700 rounded-full">
                Live
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <OrderBoard canteenId={canteenId} />
      </main>
    </div>
  );
}