/**
 * SOURCE OF TRUTH KEYWORDS: pickup-slot-picker, time-slot-selection, capacity-indicator, student-ui
 * WHAT: Time-slot selection component with progress indicators for reserved slot capacity and instant disable locks when slots reach capacity
 * WHY: Allows students to select pickup time slots with real-time capacity visualization and prevents overbooking
 * WHERE: src/components/global/pickup-slot-picker/index.tsx
 */

import { PickupSlot } from "@/lib/types/domain";

interface PickupSlotPickerProps {
  slots: PickupSlot[];
  selectedSlotId?: string;
  onSelect: (slotId: string) => void;
  className?: string;
  disabled?: boolean;
}

interface SlotWithAvailability extends PickupSlot {
  availableCapacity: number;
  isFull: boolean;
  fillPercentage: number;
}

export function PickupSlotPicker({
  slots,
  selectedSlotId,
  onSelect,
  className,
  disabled = false,
}: PickupSlotPickerProps) {
  const slotsWithAvailability: SlotWithAvailability[] = slots.map((slot) => ({
    ...slot,
    availableCapacity: Math.max(0, slot.capacityLimit - slot.reservedCount),
    isFull: slot.reservedCount >= slot.capacityLimit,
    fillPercentage:
      slot.capacityLimit > 0
        ? Math.min(100, Math.round((slot.reservedCount / slot.capacityLimit) * 100))
        : 0,
  }));

  const formatTime = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (slots.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No pickup slots available for this time period</p>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className || ""}`}
      role="radiogroup"
      aria-label="Pickup time slots"
    >
      {slotsWithAvailability.map((slot) => (
        <button
          key={slot.id}
          type="button"
          role="radio"
          aria-checked={selectedSlotId === slot.id}
          aria-disabled={slot.isFull || disabled}
          onClick={() => !slot.isFull && !disabled && onSelect(slot.id)}
          disabled={slot.isFull || disabled}
          className={`
            relative group flex flex-col items-center p-4 rounded-lg border-2 transition-all duration-200
            ${selectedSlotId === slot.id
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:bg-accent"
            }
            ${slot.isFull || disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          `}
        >
          <div className="w-full mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-medium">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
              <span className={`font-medium ${
                slot.isFull ? "text-destructive" : slot.fillPercentage > 80 ? "text-amber-500" : "text-muted-foreground"
              }`}>
                {slot.availableCapacity}/{slot.capacityLimit}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={slot.fillPercentage} aria-valuemin={0} aria-valuemax={100} aria-label={`Slot capacity ${slot.fillPercentage}% full`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  slot.fillPercentage === 100
                    ? "bg-destructive"
                    : slot.fillPercentage > 80
                    ? "bg-amber-500"
                    : "bg-primary"
                }`}
                style={{ width: `${slot.fillPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 w-full text-sm">
            {slot.isFull && (
              <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Full
              </span>
            )}
            {slot.preparationBuffer && !slot.isFull && (
              <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {slot.preparationBuffer}min prep
              </span>
            )}
          </div>

          {selectedSlotId === slot.id && (
            <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none" aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );
}