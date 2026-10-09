/**
 * SOURCE OF TRUTH KEYWORDS: active-order-tracker, order-progress, student-ui, state-machine, qr-collection
 * WHAT: Live order progress tracker with cancellation gating (disabled at PREPARING+) and QR collection button (active at READY)
 * WHY: Provides real-time order status visualization with action buttons gated by server-enforced state machine transitions
 * WHERE: src/app/(student)/orders/_components/active-order-tracker.tsx
 */

"use client";

import { useState, useEffect } from "react";
import { useOrder, useUpdateOrderStatus } from "@/lib/hooks/use-queries";
import { StatusBadge } from "@/components/global/status-badge";
import { QRCodeModal } from "@/components/global/qr-code-modal";
import { OrderStatus } from "@/lib/types/domain";

interface ActiveOrderTrackerProps {
  orderId: string;
  onOrderUpdate?: () => void;
  className?: string;
}

const STATUS_STEPS: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.COLLECTED,
];

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Order Placed",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready for Pickup",
  COLLECTED: "Collected",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

const statusDescriptions: Record<OrderStatus, string> = {
  PENDING: "Waiting for canteen confirmation",
  CONFIRMED: "Canteen accepted your order",
  PREPARING: "Your meal is being prepared",
  READY: "Ready for collection - show QR code",
  COLLECTED: "Order successfully collected",
  CANCELLED: "Order was cancelled",
  REJECTED: "Order was rejected by canteen",
};

const canStudentCancel = (status: OrderStatus): boolean => {
  return [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(status);
};

const isTerminal = (status: OrderStatus): boolean => {
  return [OrderStatus.COLLECTED, OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(status);
}

export function ActiveOrderTracker({
  orderId,
  onOrderUpdate,
  className,
}: ActiveOrderTrackerProps) {
  const { data: order, isLoading, refetch } = useOrder(orderId);
  const updateStatus = useUpdateOrderStatus();
  const [showQR, setShowQR] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderStatus = order?.status;

  useEffect(() => {
    if (orderStatus && !isTerminal(orderStatus)) {
      const interval = setInterval(() => refetch(), 10000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [orderStatus, refetch]);

  const handleCancel = async () => {
    if (!order || !canStudentCancel(order.status)) return;

    setCancelling(true);
    setError(null);
    try {
      await updateStatus.mutateAsync({ id: orderId, status: OrderStatus.CANCELLED, reason: "Student cancelled" });
      await refetch();
      onOrderUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  const currentStepIndex = orderStatus ? STATUS_STEPS.indexOf(orderStatus) : -1;
  const showStepper = currentStepIndex >= 0;

  if (isLoading) {
    return (
      <div className={className}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-20 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className={className}>
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-lg">Order not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">Order {order.orderNumber}</h2>
                <StatusBadge status={order.status} size="md" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {statusDescriptions[order.status] || ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canStudentCancel(order.status) && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-3 py-1.5 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50"
                >
                  {cancelling ? "Cancelling..." : "Cancel Order"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {showStepper ? (
          <div className="relative">
            <div className="absolute top-8 left-0 right-0 h-0.5 bg-muted z-0" />
            <div className="relative z-10 flex items-center justify-between">
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isFuture = index > currentStepIndex;

                return (
                  <div key={step} className="flex flex-col items-center flex-1">
                    <div className="relative flex items-center justify-center">
                      <div className={`
                        w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-300
                        ${isCompleted
                          ? "bg-primary border-primary text-primary-foreground"
                          : isCurrent
                          ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted border-border text-muted-foreground"
                        }
                      `}>
                        {isCompleted ? (
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : index === 0 ? (
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                        ) : index === 1 ? (
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : index === 2 ? (
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v16z" />
                          </svg>
                        ) : (
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      {isFuture && index < STATUS_STEPS.length - 1 && (
                        <div className="absolute top-8 left-1/2 right-1/2 h-0.5 bg-muted z-0" />
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <p className={`text-sm font-medium ${isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                        {statusLabels[step]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          ) : null}

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Canteen</p>
              <p className="font-medium">{order.canteen?.name || "Loading..."}</p>
              <p className="text-xs text-muted-foreground mt-1">{order.canteen?.address}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Pickup Window</p>
              <p className="font-medium">
                {order.pickupSlot ? (
                  <>
                    {new Date(order.pickupSlot.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} -{" "}
                    {new Date(order.pickupSlot.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                  </>
                ) : (
                  "TBA"
                )}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium text-foreground mb-3">Items</h3>
            <div className="space-y-2">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253v-13z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.itemNameSnapshot}</p>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.totalPrice)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.unitPrice)} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(order.subtotal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Platform Fee</p>
                <p className="font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(order.platformFee)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-foreground">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(order.totalAmount)}</p>
              </div>
            </div>
          </div>

          {order.status === OrderStatus.READY && order.qrToken ? (
            <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Your order is ready for pickup!
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Show the QR code to the canteen staff to collect your order.
                  </p>
                </div>
                <button
                  onClick={() => setShowQR(true)}
                  className="px-6 py-3 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
                >
                  Show QR Code
                </button>
              </div>
            </div>
          ) : null}

          {isTerminal(order.status) && order.status !== OrderStatus.COLLECTED && (
            <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border">
              <p className="text-center text-muted-foreground">
                This order has been {order.status.toLowerCase()}.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </div>

      {showQR && order.qrToken ? (
        <QRCodeModal
          isOpen={showQR}
          onClose={() => setShowQR(false)}
          qrToken={order.qrToken}
          orderNumber={order.orderNumber}
          canteenName={order.canteen?.name || "Canteen"}
          expiresAt={order.qrExpiresAt || new Date(Date.now() + 30 * 60 * 1000)}
          onCollected={() => {
            refetch();
            onOrderUpdate?.();
          }}
        />
      ) : null}
    </div>
  );
}