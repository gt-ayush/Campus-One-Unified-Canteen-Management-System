/**
 * SOURCE OF TRUTH KEYWORDS: canteen-explorer, menu-view, category-tabs, stock-counters, student-ui
 * WHAT: Student canteen explorer page with canteen selection grid, category tabs, item search, and real-time stock counters
 * WHY: Provides the main student interface for browsing canteens, viewing menus, and building orders
 * WHERE: src/app/(student)/canteens/page.tsx
 */

"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCanteens, useMenuItems, usePickupSlots, useFoodPasses, useCreateOrder } from "@/lib/hooks/use-queries";
import { CanteenCard } from "@/components/global/canteen-card";
import { CartSlideOver } from "./_components/cart-slide-over";
import { MenuItem, PickupSlot, Canteen, CartItem } from "@/lib/types/domain";

interface AlternativeOption {
  menuItemId: string;
  menuItemName: string;
  canteenId: string;
  canteenName: string;
  price: number;
}

export default function CanteensPage() {
  return (
    <Suspense fallback={<CanteensLoading />}>
      <CanteensPageContent />
    </Suspense>
  );
}

function CanteensLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-video bg-muted rounded-xl" />
                <div className="mt-3 h-4 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CanteensPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedCanteenId, setSelectedCanteenId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PickupSlot | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeOption[]>([]);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const { data: canteensData, isLoading: canteensLoading } = useCanteens();
  const { data: foodPassesData } = useFoodPasses();
  const createOrder = useCreateOrder();

  const canteenId = selectedCanteenId || searchParams.get("canteenId");
  const { data: menuData, isLoading: menuLoading } = useMenuItems(canteenId || "", selectedCategory === "all" ? undefined : { category: selectedCategory });
  const { data: slotsData } = usePickupSlots(canteenId || "");

  const foodPassBalance = foodPassesData?.data?.[0]?.remainingCredits || 0;
  const activeCanteen = canteensData?.data?.find((c: Canteen) => c.id === canteenId);
  const availableSlots = slotsData?.data || [];
  const categories = ["all", ...new Set(menuData?.data?.map((item: MenuItem) => item.category).filter(Boolean))];

  const handleAddToCart = useCallback((item: MenuItem) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.menuItem.id === item.id);
      if (existing) {
        if (existing.quantity >= item.maxPerOrder) return prev;
        return prev.map(i => i.menuItem.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
    setCartOpen(true);
  }, []);

  const handleUpdateQuantity = useCallback((menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(prev => prev.filter(i => i.menuItem.id !== menuItemId));
    } else {
      setCartItems(prev => prev.map(i => i.menuItem.id === menuItemId ? { ...i, quantity } : i));
    }
  }, []);

  const handleRemoveItem = useCallback((menuItemId: string) => {
    setCartItems(prev => prev.filter(i => i.menuItem.id !== menuItemId));
  }, []);

  const handleSelectSlot = useCallback((slotId: string) => {
    const slot = availableSlots.find((s) => s.id === slotId);
    setSelectedSlot(slot ?? null);
  }, [availableSlots]);

  const handleSubmitOrder = useCallback(async () => {
    if (!selectedSlot || cartItems.length === 0) return;

    try {
      const result = await createOrder.mutateAsync({
        canteenId: canteenId!,
        pickupSlotId: selectedSlot.id,
        items: cartItems.map(item => ({ menuItemId: item.menuItem.id, quantity: item.quantity })),
      });

      if (result.alternatives && result.alternatives.length > 0) {
        setAlternatives(result.alternatives);
        setShowAlternatives(true);
      } else {
        setCartItems([]);
        setSelectedSlot(null);
        setCartOpen(false);
        router.push(`/student/orders?success=true`);
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes("INSUFFICIENT_STOCK") || error.message.includes("PICKUP_SLOT_FULL"))) {
        const orderError = error as { alternatives?: AlternativeOption[] };
        if (orderError.alternatives && orderError.alternatives.length > 0) {
          setAlternatives(orderError.alternatives);
          setShowAlternatives(true);
        }
      }
    }
  }, [createOrder, selectedSlot, cartItems, selectedCanteenId, router]);

  const handleAlternativeSelect = useCallback(async (alternative: AlternativeOption) => {
    setShowAlternatives(false);
    setSelectedSlot(null);
    setCartItems([]);
    setSelectedCanteenId(alternative.canteenId);
    setTimeout(() => {
      setCartOpen(true);
    }, 100);
  }, []);

  const subtotal = cartItems.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  const platformFee = subtotal * 0.1;
  const total = subtotal + platformFee;
  const remainingBalance = foodPassBalance - total;

  const canteens = canteensData?.data || [];

  if (!canteenId) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Choose a Canteen</h1>
            <p className="text-muted-foreground mt-1">Browse available canteens and their menus</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {canteensLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-video bg-muted rounded-xl" />
                  <div className="mt-3 h-4 bg-muted rounded w-3/4" />
                  <div className="mt-2 h-4 bg-muted rounded w-1/2" />
                </div>
              ))
            ) : (
              canteens.map(canteen => (
                <CanteenCard
                  key={canteen.id}
                  canteen={canteen}
                  onClick={() => router.push(`/student/canteens?canteenId=${canteen.id}`)}
                  variant="default"
                />
              ))
            )}
          </div>

          {canteens.length === 0 && !canteensLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No canteens available at the moment</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!activeCanteen) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Canteen not found</p>
          <button
            onClick={() => router.push("/student/canteens")}
            className="mt-4 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90"
          >
            Back to Canteens
          </button>
        </div>
      </div>
    );
  }

  const menuItems = menuData?.data || [];
  const filteredItems = searchQuery
    ? menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : menuItems;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => router.push("/student/canteens")}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Back to canteens"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">{activeCanteen.name}</h1>
              <p className="text-xs text-muted-foreground truncate">{activeCanteen.address}</p>
            </div>
            <button
              onClick={() => setCartOpen(!cartOpen)}
              className={`
                relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors
                ${cartItems.length > 0 ? "text-primary" : ""}
              `}
              aria-label={`Cart${cartItems.length > 0 ? ` (${cartItems.reduce((s, i) => s + i.quantity, 0)} items)` : ""}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                  {cartItems.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="border-t border-border pt-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`
                  px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors
                  ${selectedCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }
                `}
                aria-selected={selectedCategory === category}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <div className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search menu items..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  aria-label="Search menu items"
                />
              </div>
            </div>

            {menuLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square bg-muted rounded-lg" />
                    <div className="mt-2 h-4 bg-muted rounded w-3/4" />
                    <div className="mt-1 h-3 bg-muted rounded w-1/2" />
                    <div className="mt-2 h-4 bg-muted rounded w-1/3" />
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">{searchQuery ? "No items match your search" : "No items in this category"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map(item => (
                  <article
                    key={item.id}
                    className="group relative bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <svg className="w-16 h-16 mx-auto text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253v-13z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                      {!item.isAvailable && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="px-3 py-1 text-sm font-medium text-white bg-destructive/90 rounded">Unavailable</span>
                        </div>
                      )}
                      {item.stockQuantity > 0 && item.stockQuantity <= 5 && (
                        <span className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-amber-500/90 text-white rounded">Only {item.stockQuantity} left</span>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-foreground truncate">{item.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        </div>
                        <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(item.price)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {item.stockQuantity > 0 ? `${item.stockQuantity} in stock` : "Out of stock"}
                        </span>
                        <button
                          onClick={() => handleAddToCart(item)}
                          disabled={!item.isAvailable || item.stockQuantity === 0}
                          className={`
                            px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                            ${!item.isAvailable || item.stockQuantity === 0
                              ? "bg-muted text-muted-foreground cursor-not-allowed"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }
                          `}
                          aria-disabled={!item.isAvailable || item.stockQuantity === 0}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="lg:w-80 flex-shrink-0">
            <div className="sticky top-20 space-y-4">
              <div className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-semibold text-foreground mb-3">Food Pass Balance</h3>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-3xl font-bold text-foreground">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(foodPassBalance)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  After order: <span className={remainingBalance < 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(remainingBalance)}
                  </span>
                </div>
              </div>

              {cartItems.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <h3 className="font-semibold text-foreground mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform fee</span>
                      <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(platformFee)}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-2 border-t border-border">
                      <span>Total</span>
                      <span>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}</span>
                    </div>
                  </div>
                  {selectedSlot && (
                    <div className="mt-3 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Pickup Time</p>
                      <p className="text-sm font-medium">
                        {new Date(selectedSlot.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} - {new Date(selectedSlot.endTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {alternatives.length > 0 && showAlternatives && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-800 mb-2">Alternative Options Available</h3>
                  <p className="text-sm text-amber-700 mb-3">Some items are unavailable. Choose an alternative:</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {alternatives.slice(0, 3).map((alt: any) => (
                      <button
                        key={alt.menuItemId}
                        onClick={() => handleAlternativeSelect(alt)}
                        className="w-full text-left p-2 rounded-lg bg-white border border-amber-200 hover:bg-amber-50 transition-colors"
                      >
                        <p className="font-medium text-amber-900 text-sm">{alt.menuItemName}</p>
                        <p className="text-xs text-amber-600">{alt.canteenName} • {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(alt.price)}</p>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowAlternatives(false)}
                    className="mt-2 w-full text-sm text-amber-600 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <CartSlideOver
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        selectedSlot={selectedSlot}
        onSelectSlot={handleSelectSlot}
        availableSlots={availableSlots}
        foodPassBalance={foodPassBalance}
        onSubmitOrder={handleSubmitOrder}
        isSubmitting={createOrder.isPending}
        canteenName={activeCanteen.name}
      />
    </div>
  );
}