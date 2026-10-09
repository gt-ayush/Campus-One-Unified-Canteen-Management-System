/**
 * SOURCE OF TRUTH KEYWORDS: capacity-manager, pickup-slots, slot-configuration, merchant-ui, rush-hour-management
 * WHAT: Pickup slot capacity manager for merchants to configure time windows, capacity limits, and rush hour management
 * WHY: Allows merchants to adjust order limits per window during peak rush hours with real-time availability display
 * WHERE: src/app/(merchant)/slots/_components/capacity-manager.tsx
 */

"use client";

import { useState, useEffect } from "react";
import { usePickupSlots } from "@/lib/hooks/use-queries";
import { useMutation } from "@tanstack/react-query";
import { PickupSlot, OrderStatus } from "@/lib/types/domain";
import { StatusBadge } from "@/components/global/status-badge";

interface CapacityManagerProps {
  canteenId: string;
  className?: string;
}

interface SlotFormData {
  startTime: string;
  endTime: string;
  capacityLimit: number;
  preparationBuffer: number;
  isActive: boolean;
}

// Helper functions (defined at top level for use in child components)
function formatTime(dateString: string | Date): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(dateString: string | Date): string {
  return new Date(dateString).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

interface SlotRowProps {
  slot: PickupSlot;
  onEdit: (slot: PickupSlot) => void;
  onDelete: (slot: PickupSlot) => void;
  isDeleting: boolean;
}

function SlotRow({ slot, onEdit, onDelete, isDeleting }: SlotRowProps) {
  const fillPercentage = slot.capacityLimit > 0 ? Math.min(100, Math.round((slot.reservedCount / slot.capacityLimit) * 100)) : 0;

  return (
    <tr key={slot.id} className="hover:bg-muted/50 transition-colors">
      <td className="p-3">
        <div className="font-medium text-foreground">
          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(slot.startTime)}
        </div>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-xs">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${fillPercentage >= 100 ? "bg-destructive" : fillPercentage >= 80 ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${fillPercentage}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-foreground whitespace-nowrap">
            {slot.capacityLimit - slot.reservedCount}/{slot.capacityLimit}
          </span>
        </div>
      </td>
      <td className="p-3">
        <StatusBadge status={slot.isActive ? OrderStatus.READY : OrderStatus.CANCELLED} size="sm" />
      </td>
      <td className="p-3 text-sm text-muted-foreground">
        {slot.preparationBuffer} min
      </td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(slot)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Edit slot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(slot)}
            disabled={isDeleting}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            aria-label="Delete slot"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v12M10 3h4a1 1 0 011 1v3H7V4a1 1 0 011-1h4z" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

interface SlotCardProps {
  slot: PickupSlot;
  onEdit: (slot: PickupSlot) => void;
  onDelete: (slot: PickupSlot) => void;
  isDeleting: boolean;
}

function SlotCard({ slot, onEdit, onDelete, isDeleting }: SlotCardProps) {
  const fillPercentage = slot.capacityLimit > 0 ? Math.min(100, Math.round((slot.reservedCount / slot.capacityLimit) * 100)) : 0;

  return (
    <div key={slot.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-3">
        <span className="font-medium text-foreground">
          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
        </span>
        <StatusBadge status={slot.isActive ? OrderStatus.READY : OrderStatus.CANCELLED} size="sm" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-sm">
          <span className="font-medium text-foreground">
            {slot.capacityLimit - slot.reservedCount}/{slot.capacityLimit}
          </span>
          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${fillPercentage >= 100 ? "bg-destructive" : fillPercentage >= 80 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${fillPercentage}%` }}
            />
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(slot)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Edit"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(slot)}
            disabled={isDeleting}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            aria-label="Delete"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v12M10 3h4a1 1 0 011 1v3H7V4a1 1 0 011-1h4z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-muted rounded w-1/4" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-20 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  onCreateClick: () => void;
}

function EmptyState({ onCreateClick }: EmptyStateProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-12 text-center">
      <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 className="text-lg font-medium text-foreground mb-2">No Pickup Slots Configured</h3>
      <p className="text-muted-foreground mb-6">Create your first pickup slot to start accepting orders</p>
      <button
        onClick={onCreateClick}
        className="px-6 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
      >
        Create First Slot
      </button>
    </div>
  );
}

interface CapacityManagerProps {
  canteenId: string;
  className?: string;
}

interface SlotFormData {
  startTime: string;
  endTime: string;
  capacityLimit: number;
  preparationBuffer: number;
  isActive: boolean;
}

export function CapacityManager({ canteenId, className }: CapacityManagerProps) {
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState<PickupSlot | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<SlotFormData>({
    startTime: "",
    endTime: "",
    capacityLimit: 30,
    preparationBuffer: 15,
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<string | null>(null);

  const { data: slotsData, refetch } = usePickupSlots(canteenId);
  const createMutation = useMutation({
    mutationFn: (data: SlotFormData) => fetch("/api/v1/pickup-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, canteenId }),
    }).then(r => r.json()),
    onSuccess: () => { refetch(); setShowCreateModal(false); resetForm(); },
    onError: (err: any) => setError(err.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SlotFormData> }) => fetch(`/api/v1/pickup-slots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { refetch(); setEditingSlot(null); },
    onError: (err: any) => setError(err.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/v1/pickup-slots/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { refetch(); setDeletingSlot(null); },
    onError: (err: any) => setError(err.message),
  });

  useEffect(() => {
    if (slotsData?.data) {
      setSlots(slotsData.data);
    }
    setIsLoading(false);
  }, [slotsData]);

  const resetForm = () => {
    setFormData({
      startTime: "",
      endTime: "",
      capacityLimit: 30,
      preparationBuffer: 15,
      isActive: true,
    });
  };

  const handleCreate = () => {
    if (!formData.startTime || !formData.endTime) {
      setError("Please select start and end times");
      return;
    }
    if (formData.startTime >= formData.endTime) {
      setError("End time must be after start time");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    if (!editingSlot) return;
    if (!formData.startTime || !formData.endTime) {
      setError("Please select start and end times");
      return;
    }
    if (formData.startTime >= formData.endTime) {
      setError("End time must be after start time");
      return;
    }
    updateMutation.mutate({ id: editingSlot.id, data: formData });
  };

  const handleDelete = (slot: PickupSlot) => {
    if (confirm(`Delete slot ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}? This cannot be undone.`)) {
      setDeletingSlot(slot.id);
      deleteMutation.mutate(slot.id);
    }
  };

  const handleEdit = (slot: PickupSlot) => {
    setEditingSlot(slot);
    setFormData({
      startTime: new Date(slot.startTime).toISOString().slice(11, 16),
      endTime: new Date(slot.endTime).toISOString().slice(11, 16),
      capacityLimit: slot.capacityLimit,
      preparationBuffer: slot.preparationBuffer,
      isActive: slot.isActive,
    });
  };

  const formatTime = (dateString: string | Date): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  const formatDate = (dateString: string | Date): string => {
    return new Date(dateString).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  const groupSlotsByDate = (slots: PickupSlot[]): Record<string, PickupSlot[]> => {
    const grouped: Record<string, PickupSlot[]> = {};
    slots.forEach(slot => {
      const date = formatDate(slot.startTime);
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(slot);
    });
    return grouped;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Pickup Slot Capacity Manager</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure pickup time windows and capacity limits for rush hour management
          </p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); resetForm(); }}
          className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Slot
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-destructive hover:underline">Dismiss</button>
        </div>
      )}

      {slots.length === 0 ? (
        <EmptyState onCreateClick={() => { setShowCreateModal(true); resetForm(); }} />
      ) : (
        <div>
          <div className="overflow-x-auto mb-6">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Time</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Capacity</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 text-sm font-medium text-muted-foreground">Prep Buffer</th>
                  <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {slots.map(slot => (
                  <SlotRow
                    key={slot.id}
                    slot={slot}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isDeleting={deletingSlot === slot.id}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(groupSlotsByDate(slots)).map(([date, daySlots]) => (
              <div key={date} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                  <h3 className="font-semibold text-foreground">{date}</h3>
                  <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                    {daySlots.length} slots
                  </span>
                </div>
                <div className="space-y-2">
                  {daySlots.map(slot => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isDeleting={deletingSlot === slot.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(showCreateModal || editingSlot) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="slot-modal-title">
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-2xl p-6">
            <h3 id="slot-modal-title" className="text-lg font-semibold text-foreground mb-4">
              {editingSlot ? "Edit Pickup Slot" : "Create Pickup Slot"}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="slot-start" className="block text-sm font-medium text-foreground mb-1">Start Time</label>
                  <input
                    id="slot-start"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="slot-end" className="block text-sm font-medium text-foreground mb-1">End Time</label>
                  <input
                    id="slot-end"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="slot-capacity" className="block text-sm font-medium text-foreground mb-1">Capacity Limit</label>
                  <input
                    id="slot-capacity"
                    type="number"
                    min={1}
                    max={500}
                    value={formData.capacityLimit}
                    onChange={(e) => setFormData({ ...formData, capacityLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="slot-buffer" className="block text-sm font-medium text-foreground mb-1">Prep Buffer (min)</label>
                  <input
                    id="slot-buffer"
                    type="number"
                    min={0}
                    max={60}
                    value={formData.preparationBuffer}
                    onChange={(e) => setFormData({ ...formData, preparationBuffer: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                Slot is active
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowCreateModal(false); setEditingSlot(null); resetForm(); }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={editingSlot ? handleUpdate : handleCreate}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {editingSlot ? "Save Changes" : "Create Slot"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}