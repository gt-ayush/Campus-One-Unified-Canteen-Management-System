/**
 * SOURCE OF TRUTH KEYWORDS: merchant-approval, approval-queue, admin-ui, merchant-onboarding
 * WHAT: Admin merchant approval queue with review pending registrations and activation toggling
 * WHY: Provides administrators with a queue to review and approve/reject merchant registrations
 * WHERE: src/app/(admin)/merchants/_components/approval-queue.tsx
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useCanteens } from "@/lib/hooks/use-queries";
import { StatusBadge } from "@/components/global/status-badge";
import { OrderStatus, Canteen } from "@/lib/types/domain";

interface ApprovalQueueProps {
  className?: string;
}

interface Merchant {
  id: string;
  email: string;
  role: string;
  status: string;
  canteen?: {
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    isApproved: boolean;
    commissionRate: number;
  };
  merchantStaff?: {
    id: string;
    fullName: string;
    position: string;
    phone: string;
    isActive: boolean;
  };
  createdAt: string;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-1/3" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-muted rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-1/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
              <div className="w-24 h-8 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="text-center py-12">
      <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 className="text-lg font-medium text-foreground mb-1">No merchants found</h3>
      <p className="text-muted-foreground">
        {filter !== "all" ? `No ${filter} merchants found` : "No merchant registrations found"}
      </p>
    </div>
  );
}

function MerchantCard({ merchant, onApprove, onReject, onView, isActing, isRejected }: {
  merchant: Merchant;
  onApprove: (merchant: Merchant) => void;
  onReject: (merchant: Merchant) => void;
  onView: (merchant: Merchant) => void;
  isActing: boolean;
  isRejected: boolean;
}) {
  return (
    <article key={merchant.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{merchant.canteen?.name || "Unnamed Canteen"}</h3>
              <p className="text-sm text-muted-foreground">{merchant.canteen?.address || "No address"}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Owner:</p>
              <p className="font-medium">{merchant.merchantStaff?.fullName || "Unknown"}</p>
              <p className="text-xs text-muted-foreground">({merchant.merchantStaff?.position || "Owner"})</p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Email:</p>
              <p className="text-sm font-mono">{merchant.email}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Status:</p>
            {merchant.canteen?.isApproved ? (
              <StatusBadge status={OrderStatus.READY} size="sm" />
            ) : isRejected ? (
              <StatusBadge status={OrderStatus.REJECTED} size="sm" />
            ) : (
              <StatusBadge status={OrderStatus.PENDING} size="sm" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">Registered:</p>
            <span className="text-sm text-muted-foreground">{new Date(merchant.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {merchant.canteen?.isApproved ? (
              <button
                onClick={() => onView(merchant)}
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                View Details
              </button>
            ) : isRejected ? (
              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(merchant)}
                  disabled={isActing}
                  className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 border border-green-200 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  {isActing ? "Approving..." : "Approve Anyway"}
                </button>
                <button
                  onClick={() => onView(merchant)}
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  View Details
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => onApprove(merchant)}
                  disabled={isActing}
                  className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 border border-green-200 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                >
                  {isActing ? "Approving..." : "Approve"}
                </button>
                <button
                  onClick={() => onReject(merchant)}
                  disabled={isActing}
                  className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 border border-red-200 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                >
                  {isActing ? "Rejecting..." : "Reject"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 bg-muted/30 border-t border-border">
        <h4 className="font-medium text-foreground mb-3">Canteen Details</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="font-medium">{merchant.canteen?.phone || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{merchant.canteen?.email || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Address</p>
            <p className="font-medium truncate">{merchant.canteen?.address || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Commission</p>
            <p className="font-medium">{((merchant.canteen?.commissionRate ?? 0) * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ApprovalQueue({ className }: ApprovalQueueProps) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [rejectedIds, setRejectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: canteensData, refetch } = useCanteens({ limit: 100 });

  useEffect(() => {
    if (canteensData?.data) {
      const mapped: Merchant[] = canteensData.data.map((canteen: Canteen) => ({
        id: canteen.id,
        email: canteen.email,
        role: "MERCHANT_STAFF",
        status: canteen.isApproved ? "ACTIVE" : "PENDING",
        canteen: {
          id: canteen.id,
          name: canteen.name,
          address: canteen.address,
          phone: canteen.phone,
          email: canteen.email,
          isApproved: canteen.isApproved,
          commissionRate: canteen.commissionRate,
        },
        createdAt: canteen.createdAt instanceof Date ? canteen.createdAt.toISOString() : String(canteen.createdAt),
      }));
      setMerchants(mapped);
    }
    setIsLoading(false);
  }, [canteensData]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const isRejected = (id: string): boolean => rejectedIds.includes(id);

  const filteredMerchants = merchants
    .filter(m => {
      if (filter === "all") return true;
      if (filter === "pending") return m.canteen?.isApproved === false && !isRejected(m.id);
      if (filter === "approved") return m.canteen?.isApproved === true;
      if (filter === "rejected") return isRejected(m.id);
      return true;
    })
    .filter(m =>
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.canteen?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.canteen?.address.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const pendingCount = merchants.filter(m => m.canteen?.isApproved === false && !isRejected(m.id)).length;
  const approvedCount = merchants.filter(m => m.canteen?.isApproved === true).length;
  const rejectedCount = rejectedIds.length;

  const applyApprovalResult = (canteenId: string, approved: boolean) => {
    setMerchants((prev) =>
      prev.map((m) =>
        m.canteen?.id === canteenId
          ? {
              ...m,
              status: approved ? "ACTIVE" : m.status,
              canteen: { ...m.canteen, isApproved: approved },
            }
          : m
      )
    );
  };

  const handleApprove = useCallback(async (merchant: Merchant) => {
    if (!merchant.canteen) return;
    setActionLoading(merchant.id);
    setError(null);
    try {
      const response = await fetch(`/api/v1/canteens/${merchant.canteen.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Approval failed (HTTP ${response.status})`);
      }
      applyApprovalResult(merchant.canteen.id, true);
      setRejectedIds((prev) => prev.filter((id) => id !== merchant.id));
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve merchant");
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const handleReject = useCallback(async (merchant: Merchant) => {
    if (!merchant.canteen) return;
    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return;

    setActionLoading(merchant.id);
    setError(null);
    try {
      const response = await fetch(`/api/v1/canteens/${merchant.canteen.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", ...(reason ? { notes: reason } : {}) }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Rejection failed (HTTP ${response.status})`);
      }
      setRejectedIds((prev) => (prev.includes(merchant.id) ? prev : [...prev, merchant.id]));
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject merchant");
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const handleView = useCallback((merchant: Merchant) => {
    setSelectedMerchant(merchant);
  }, []);

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Merchant Approval Queue</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve merchant registrations
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-muted rounded-lg p-1" role="radiogroup">
            {["all", "pending", "approved", "rejected"].map(f => (
              <button
                key={f}
                role="radio"
                aria-selected={filter === f}
                onClick={() => setFilter(f as typeof filter)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {(f === "pending" && pendingCount > 0) ||
                 (f === "approved" && approvedCount > 0) ||
                 (f === "rejected" && rejectedCount > 0) ||
                 (f === "all" && merchants.length > 0) ? (
                  <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                    {f === "all" ? merchants.length :
                     f === "pending" ? pendingCount :
                     f === "approved" ? approvedCount : rejectedCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search merchants..."
              className="w-64 pl-10 pr-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-destructive hover:underline">Dismiss</button>
        </div>
      )}

      {filteredMerchants.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-3">
          {filteredMerchants.map(merchant => (
            <MerchantCard
              key={merchant.id}
              merchant={merchant}
              onApprove={handleApprove}
              onReject={handleReject}
              onView={handleView}
              isActing={actionLoading === merchant.id}
              isRejected={isRejected(merchant.id)}
            />
          ))}
        </div>
      )}

      {selectedMerchant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="merchant-details-title">
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-2xl p-6">
            <h3 id="merchant-details-title" className="text-lg font-semibold text-foreground mb-4">Merchant Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Canteen</span>
                <span className="font-medium text-foreground">{selectedMerchant.canteen?.name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-mono text-foreground">{selectedMerchant.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Address</span>
                <span className="font-medium text-foreground text-right">{selectedMerchant.canteen?.address ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium text-foreground">{selectedMerchant.canteen?.phone ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-foreground">{selectedMerchant.status}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedMerchant(null)}
              className="mt-6 w-full px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>Showing {filteredMerchants.length} of {merchants.length} merchants</span>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 disabled:opacity-50" disabled>
            Previous
          </button>
          <button className="px-3 py-1.5 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 disabled:opacity-50" disabled>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}