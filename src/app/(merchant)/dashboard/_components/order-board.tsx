/**
 * SOURCE OF TRUTH KEYWORDS: merchant-orders, order-board, kanban, real-time, state-transitions
 * WHAT: Merchant real-time order management board with multi-column kanban (Pending, Confirmed, Preparing, Ready) and one-click state transitions
 * WHY: Provides merchants with an operational dashboard to manage incoming orders with one-click status updates and audit logging
 * WHERE: src/app/(merchant)/orders/_components/order-board.tsx
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrders, useUpdateOrderStatus } from "@/lib/hooks/use-queries";
import { StatusBadge } from "@/components/global/status-badge";
import { Order, OrderStatus } from "@/lib/types/domain";

const KANBAN_COLUMNS: { status: OrderStatus; label: string; color: string }[] = [
  { status: OrderStatus.PENDING, label: "Pending", color: "warning" },
  { status: OrderStatus.CONFIRMED, label: "Confirmed", color: "info" },
  { status: OrderStatus.PREPARING, label: "Preparing", color: "default" },
  { status: OrderStatus.READY, label: "Ready", color: "success" },
];

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.REJECTED],
  CONFIRMED: [OrderStatus.PREPARING, OrderStatus.REJECTED],
  PREPARING: [OrderStatus.READY, OrderStatus.REJECTED],
  READY: [OrderStatus.COLLECTED, OrderStatus.REJECTED],
  COLLECTED: [],
  CANCELLED: [],
  REJECTED: [],
};

interface OrderBoardProps {
  canteenId: string;
  className?: string;
}

interface OrderCardProps {
  order: Order;
  allowedNextStatuses: OrderStatus[];
  onTransition: (orderId: string, status: OrderStatus) => void;
  isTransitioning: boolean;
}

function OrderCard({ order, allowedNextStatuses, onTransition, isTransitioning }: OrderCardProps) {
  const formatTime = (date: Date | string) => new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  return (
    <article className="bg-card rounded-lg border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-foreground">{order.orderNumber}</span>
            <StatusBadge status={order.status} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{order.student?.user?.email || "Student"}</p>
          <p className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-foreground">{formatCurrency(order.totalAmount)}</p>
          <p className="text-xs text-muted-foreground">{order.items?.length || 0} items</p>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        {order.items?.slice(0, 3).map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
            <span className="truncate pr-2">{item.itemNameSnapshot} × {item.quantity}</span>
            <span className="font-medium text-foreground whitespace-nowrap">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.totalPrice)}
            </span>
          </div>
        ))}
        {(order.items?.length || 0) > 3 && (
          <p className="text-xs text-muted-foreground text-center py-1">+{order.items!.length - 3} more items</p>
        )}
      </div>

      <div className="pt-3 border-t border-border">
        {allowedNextStatuses.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {allowedNextStatuses.map(nextStatus => (
              <button
                key={nextStatus}
                onClick={() => onTransition(order.id, nextStatus)}
                disabled={isTransitioning}
                className={`
                  flex-1 min-w-[80px] px-3 py-2 text-xs font-medium rounded-lg transition-colors
                  ${nextStatus === OrderStatus.REJECTED
                    ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }
                  ${isTransitioning ? "opacity-50 cursor-wait" : ""}
                `}
              >
                {isTransitioning ? (
                  <svg className="w-4 h-4 animate-spin mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : nextStatus}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-2 text-xs text-muted-foreground">
            {order.status === OrderStatus.COLLECTED ? "Order collected" : order.status === OrderStatus.CANCELLED ? "Order cancelled" : "Order rejected"}
          </div>
        )}
      </div>
    </article>
  );
}

export function OrderBoard({ canteenId, className }: OrderBoardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: ordersData, refetch } = useOrders({ canteenId, limit: 50 });
  const updateStatus = useUpdateOrderStatus();

  useEffect(() => {
    if (ordersData?.data) {
      setOrders(ordersData.data);
    }
    setIsLoading(false);
  }, [ordersData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => refetch(), 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  const handleTransition = useCallback(async (orderId: string, status: OrderStatus) => {
    setIsTransitioning(true);
    setError(null);
    try {
      await updateStatus.mutateAsync({ id: orderId, status });
      refetch();
    } catch (err: any) {
      setError(err.message || "Failed to update order status");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsTransitioning(false);
    }
  }, [updateStatus, refetch]);

  const columnOrders: Record<OrderStatus, Order[]> = {
    PENDING: [],
    CONFIRMED: [],
    PREPARING: [],
    READY: [],
    COLLECTED: [],
    CANCELLED: [],
    REJECTED: [],
  };

  orders.forEach(order => {
    if (columnOrders[order.status]) {
      columnOrders[order.status].push(order);
    }
  });

  const pendingCount = columnOrders.PENDING.length;
  const preparingCount = columnOrders.PREPARING.length;
  const readyCount = columnOrders.READY.length;

  return (
    <div className={className}>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Order Board</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {orders.length} total orders • {pendingCount} pending • {preparingCount} preparing • {readyCount} ready
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            Auto-refresh (15s)
          </label>
          <button
            onClick={() => { refetch(); setError(null); }}
            disabled={isTransitioning}
            className="px-3 py-1.5 text-sm font-medium text-foreground bg-secondary border border-border rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            {isTransitioning ? "Processing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-destructive hover:underline">Dismiss</button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map(col => (
            <div key={col.status} className="bg-card rounded-xl border border-border flex flex-col h-96">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{col.label}</h3>
                  <span className="animate-pulse h-5 w-12 bg-muted rounded" />
                </div>
              </div>
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-24 bg-muted rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_COLUMNS.map(col => {
            const columnOrders = orders.filter(o => o.status === col.status);
            return (
              <div key={col.status} className="bg-card rounded-xl border border-border flex flex-col h-[calc(100vh-300px)] min-h-[500px]">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      {col.label}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        col.color === "warning" ? "bg-amber-100 text-amber-700" :
                        col.color === "info" ? "bg-blue-100 text-blue-700" :
                        col.color === "default" ? "bg-gray-100 text-gray-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {columnOrders.length}
                      </span>
                    </h3>
                  </div>
                </div>
                <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                  {columnOrders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-sm">No {col.label.toLowerCase()} orders</p>
                    </div>
                  ) : (
                    columnOrders.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        allowedNextStatuses={ALLOWED_TRANSITIONS[order.status] || []}
                        onTransition={handleTransition}
                        isTransitioning={isTransitioning}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}