/**
 * SOURCE OF TRUTH KEYWORDS: student-orders, order-history, order-tracker, student-ui
 * WHAT: Student orders page displaying order history with active order tracking and past orders list
 * WHY: Provides students with a complete view of their orders - active orders with live tracking and historical orders
 * WHERE: src/app/(student)/orders/page.tsx
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrders } from "@/lib/hooks/use-queries";
import { ActiveOrderTracker } from "./_components/active-order-tracker";
import { OrderStatus } from "@/lib/types/domain";

const STATUS_TABS: Array<{ value: OrderStatus | "all"; label: string }> = [
  { value: "all", label: "All Orders" },
  { value: OrderStatus.PENDING, label: "Pending" },
  { value: OrderStatus.CONFIRMED, label: "Confirmed" },
  { value: OrderStatus.PREPARING, label: "Preparing" },
  { value: OrderStatus.READY, label: "Ready" },
  { value: OrderStatus.COLLECTED, label: "Collected" },
  { value: OrderStatus.CANCELLED, label: "Cancelled" },
  { value: OrderStatus.REJECTED, label: "Rejected" },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersLoading />}>
      <OrdersPageContent />
    </Suspense>
  );
}

function OrdersLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function OrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showTracker, setShowTracker] = useState(false);

  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam && STATUS_TABS.some((t) => t.value === statusParam)) {
      setActiveTab(statusParam as OrderStatus | "all");
    }
  }, [searchParams]);

  const { data: ordersData, isLoading, refetch } = useOrders(
    activeTab === "all" ? { limit: 20 } : { status: activeTab, limit: 20 }
  );

  const orders = ordersData?.data ?? [];
  const TERMINAL_STATUSES: OrderStatus[] = [
    OrderStatus.COLLECTED,
    OrderStatus.CANCELLED,
    OrderStatus.REJECTED,
  ];
  const isTerminalOrder = (status: OrderStatus): boolean =>
    TERMINAL_STATUSES.includes(status);
  const activeOrder = orders.find((o) => !isTerminalOrder(o.status));

  const handleOrderUpdate = () => {
    refetch();
  };

  const handleTrack = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowTracker(true);
  };

  const activeTabLabel =
    STATUS_TABS.find((t) => t.value === activeTab)?.label ?? activeTab;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
              <p className="text-muted-foreground text-sm">Track and manage your orders</p>
            </div>
            <button
              onClick={() => router.push("/student/canteens")}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              Browse Canteens
            </button>
          </div>
        </div>
        <div className="border-t border-border px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                aria-selected={activeTab === tab.value}
                className={`px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {showTracker && selectedOrderId ? (
          <div className="mb-6">
            <ActiveOrderTracker orderId={selectedOrderId} onOrderUpdate={handleOrderUpdate} />
          </div>
        ) : null}

        {activeOrder && !showTracker ? (
          <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">You have an active order</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Order {activeOrder.orderNumber} is {activeOrder.status.toLowerCase()}
                </p>
              </div>
              <button
                onClick={() => handleTrack(activeOrder.id)}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                Track Order
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-muted rounded-lg" />
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-32" />
                        <div className="h-3 bg-muted rounded w-24" />
                      </div>
                    </div>
                    <div className="w-24 h-8 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <h3 className="text-lg font-medium text-foreground mb-1">No orders found</h3>
              <p className="text-muted-foreground">
                {activeTab === "all"
                  ? "You haven't placed any orders yet"
                  : `No orders with status "${activeTabLabel}"`}
              </p>
              <button
                onClick={() => router.push("/student/canteens")}
                className="mt-4 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                Browse Canteens
              </button>
            </div>
          ) : (
            <div>
              {activeOrder ? (
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-foreground mb-3">Active Order</h2>
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground">Order {activeOrder.orderNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {activeOrder.canteen?.name} • {new Date(activeOrder.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                          {activeOrder.status}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">
                          {activeOrder.items?.length || 0} items • {formatCurrency(activeOrder.totalAmount)}
                        </p>
                        <button
                          onClick={() => handleTrack(activeOrder.id)}
                          className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          Track Order
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <h2 className="text-lg font-semibold text-foreground mb-3">
                {activeTab === "all" ? "Order History" : `Orders (${activeTabLabel})`}
              </h2>

              <div className="space-y-3">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">Order {order.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.canteen?.name} • {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 sm:ml-auto">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              order.status === OrderStatus.COLLECTED
                                ? "bg-green-100 text-green-700"
                                : order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REJECTED
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {order.status}
                          </span>
                          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Items</p>
                          <p className="font-medium">{order.items?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Placed</p>
                          <p className="font-medium">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Pickup</p>
                          <p className="font-medium">
                            {order.pickupSlot
                              ? `${new Date(order.pickupSlot.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })} - ${new Date(order.pickupSlot.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })}`
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-semibold text-foreground">{formatCurrency(order.totalAmount)}</p>
                        </div>
                      </div>

                      {!isTerminalOrder(order.status) && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <button
                            onClick={() => handleTrack(order.id)}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            Track Order
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
