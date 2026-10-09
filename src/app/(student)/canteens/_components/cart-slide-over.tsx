/**
 * SOURCE OF TRUTH KEYWORDS: cart-slide-over, cart-drawer, student-ui, food-pass-credits, order-preview
 * WHAT: Cart slide-over drawer with Food Pass credit deduction preview and item management
 * WHY: Provides a persistent cart experience with real-time credit calculation and order confirmation
 * WHERE: src/app/(student)/canteens/_components/cart-slide-over.tsx
 */

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { PickupSlot, CartItem } from "@/lib/types/domain";

interface CartSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (menuItemId: string, quantity: number) => void;
  onRemoveItem: (menuItemId: string) => void;
  selectedSlot?: PickupSlot | null;
  onSelectSlot: (slotId: string) => void;
  availableSlots: PickupSlot[];
  foodPassBalance: number;
  onSubmitOrder: () => void;
  isSubmitting: boolean;
  canteenName: string;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price);
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function CartSlideOver({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  selectedSlot,
  onSelectSlot,
  availableSlots,
  foodPassBalance,
  onSubmitOrder,
  isSubmitting,
  canteenName,
}: CartSlideOverProps) {
  const [activeTab, setActiveTab] = useState<"items" | "slots">("items");

  const subtotal = items.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  const platformFee = subtotal * 0.1;
  const total = subtotal + platformFee;
  const remainingBalance = foodPassBalance - total;

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="fixed right-0 top-0 bottom-0 w-full max-w-sm md:max-w-md bg-card flex flex-col shadow-2xl animate-in slide-in-from-right-4 duration-300 z-50">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="cart-title" className="text-lg font-semibold text-foreground">
            Your Order
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close cart"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex border-b border-border" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "items"}
              onClick={() => setActiveTab("items")}
              className={`
                px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === "items"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }
              `}
            >
              Order ({itemCount})
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "slots"}
              onClick={() => setActiveTab("slots")}
              className={`
                px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === "slots"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
                }
              `}
            >
              Pickup
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === "items" && (
              <>
                {items.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <p className="text-sm">Your cart is empty</p>
                    <p className="text-xs mt-1">Add items from the menu</p>
                  </div>
                ) : (
                  <>
                    {items.map((cartItem) => (
                      <div key={cartItem.menuItem.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {cartItem.menuItem.imageUrl ? (
                            <img src={cartItem.menuItem.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253v-13z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground truncate">{cartItem.menuItem.name}</h4>
                          <p className="text-sm text-muted-foreground">{formatPrice(cartItem.menuItem.price)} each</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => onUpdateQuantity(cartItem.menuItem.id, cartItem.quantity - 1)}
                              disabled={cartItem.quantity <= 1}
                              className="p-1.5 rounded border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Decrease quantity"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="w-8 text-center text-sm font-medium">{cartItem.quantity}</span>
                            <button
                              onClick={() => onUpdateQuantity(cartItem.menuItem.id, cartItem.quantity + 1)}
                              disabled={cartItem.quantity >= cartItem.menuItem.maxPerOrder}
                              className="p-1.5 rounded border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Increase quantity"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="font-medium text-foreground">{formatPrice(cartItem.menuItem.price * cartItem.quantity)}</p>
                          <button
                            onClick={() => onRemoveItem(cartItem.menuItem.id)}
                            className="text-xs text-destructive hover:underline"
                            aria-label="Remove item"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                        <span className="text-foreground">{formatPrice(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Platform fee (10%)</span>
                        <span className="text-foreground">{formatPrice(platformFee)}</span>
                      </div>
                      <div className="flex justify-between text-base font-semibold pt-2 border-t border-border">
                        <span className="text-foreground">Total</span>
                        <span className="text-foreground">{formatPrice(total)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Food Pass Balance</span>
                        <span className={remainingBalance < 0 ? "text-destructive" : "text-foreground"}>
                          {formatPrice(foodPassBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-foreground">Remaining after order</span>
                        <span className={remainingBalance < 0 ? "text-destructive" : "text-green-600"}>
                          {formatPrice(remainingBalance)}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {items.length > 0 && remainingBalance < 0 && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    <p className="font-medium">Insufficient Food Pass balance</p>
                    <p className="mt-1">Add funds to your Food Pass or remove items</p>
                  </div>
                )}
              </>
            )}

            {activeTab === "slots" && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Select Pickup Time</p>
                  <p className="text-xs text-muted-foreground">
                    Choose when you want to collect your order at {canteenName}
                  </p>
                </div>

                {availableSlots.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No pickup slots available</p>
                    <p className="text-xs mt-1">Check back later for available slots</p>
                  </div>
                ) : (
                  <div className="space-y-2" role="radiogroup" aria-label="Pickup time slots">
                    {availableSlots.map((slot) => {
                      const availableCapacity = slot.capacityLimit - slot.reservedCount;
                      const isFull = availableCapacity <= 0;
                      const fillPercentage = Math.min(100, Math.round((slot.reservedCount / slot.capacityLimit) * 100));

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          role="radio"
                          aria-checked={selectedSlot?.id === slot.id}
                          aria-disabled={isFull}
                          onClick={() => !isFull && onSelectSlot(slot.id)}
                          disabled={isFull}
                          className={`
                            relative w-full flex flex-col items-start p-3 rounded-lg border-2 transition-all duration-200
                            ${selectedSlot?.id === slot.id
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:bg-accent"
                            }
                            ${isFull ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                          `}
                        >
                          <div className="w-full mb-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span className="font-medium">
                                {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                              </span>
                              <span className={`font-medium ${isFull ? "text-destructive" : fillPercentage > 80 ? "text-amber-500" : "text-muted-foreground"}`}>
                                {slot.capacityLimit - slot.reservedCount}/{slot.capacityLimit}
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={fillPercentage} aria-valuemin={0} aria-valuemax={100}>
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${fillPercentage === 100 ? "bg-destructive" : fillPercentage > 80 ? "bg-amber-500" : "bg-primary"}`}
                                style={{ width: `${fillPercentage}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2 w-full text-sm">
                            {isFull && (
                              <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Full
                              </span>
                            )}
                          </div>
                          {selectedSlot?.id === slot.id && (
                            <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t border-border bg-card/50">
            <button
              onClick={onSubmitOrder}
              disabled={remainingBalance < 0 || !selectedSlot || isSubmitting}
              className={`
                w-full px-4 py-3 rounded-lg text-base font-semibold transition-colors
                ${remainingBalance < 0 || !selectedSlot
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
                }
                ${isSubmitting ? "opacity-75 cursor-wait" : ""}
              `}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Placing Order...
                </span>
              ) : (
                `Place Order - ${formatPrice(total)}`
              )}
            </button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              By placing this order, you agree to pick up at the selected time slot.
            </p>
          </div>
        )}
      </aside>
    </div>
  );

  return createPortal(modalContent, document.body);
}