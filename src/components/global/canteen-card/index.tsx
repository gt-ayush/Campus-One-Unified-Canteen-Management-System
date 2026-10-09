/**
 * SOURCE OF TRUTH KEYWORDS: canteen-card, canteen-availability, operational-hours, queue-load, open-closed-badges
 * WHAT: Canteen availability tile displaying operational hours, active queue load, and open/closed badges
 * WHY: Provides consistent canteen representation across student browsing and merchant/admin dashboards
 * WHERE: src/components/global/canteen-card/index.tsx
 */

import { Canteen, OperatingHours, PickupSlot, OrderStatus } from "@/lib/types/domain";

interface CanteenCardProps {
  canteen: Canteen;
  nextPickupSlot?: PickupSlot | null;
  activeOrdersCount?: number;
  variant?: "default" | "compact" | "detailed";
  onClick?: () => void;
  className?: string;
}

function getCurrentDayKey(): keyof OperatingHours {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[new Date().getDay()] as keyof OperatingHours;
}

function isCanteenOpen(canteen: Canteen): boolean {
  const today = getCurrentDayKey();
  const schedule = canteen.operatingHours[today];
  if (!schedule || !schedule.isOpen) return false;

  const now = new Date();
  const [openHour, openMin] = schedule.openTime.split(":").map(Number);
  const [closeHour, closeMin] = schedule.closeTime.split(":").map(Number);

  const openTime = new Date(now);
  openTime.setHours(openHour ?? 0, openMin ?? 0, 0, 0);

  const closeTime = new Date(now);
  closeTime.setHours(closeHour ?? 0, closeMin ?? 0, 0, 0);

  return now >= openTime && now <= closeTime;
}

function formatTime(time: string): string {
  const [hour, min] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour ?? 0, min ?? 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getQueueLevel(count: number): "low" | "medium" | "high" {
  if (count < 10) return "low";
  if (count < 30) return "medium";
  return "high";
}

const queueLevelConfig = {
  low: { label: "Low", color: "text-green-600", bg: "bg-green-100" },
  medium: { label: "Medium", color: "text-amber-600", bg: "bg-amber-100" },
  high: { label: "High", color: "text-red-600", bg: "bg-red-100" },
};

export function CanteenCard({
  canteen,
  nextPickupSlot,
  activeOrdersCount = 0,
  variant = "default",
  onClick,
  className,
}: CanteenCardProps) {
  const isOpen = isCanteenOpen(canteen);
  const today = getCurrentDayKey();
  const schedule = canteen.operatingHours[today];
  const queueLevel = getQueueLevel(activeOrdersCount);
  const queueConfig = queueLevelConfig[queueLevel];

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!isOpen}
        className={`
          flex items-center gap-3 p-3 rounded-lg border border-border bg-card
          ${!isOpen ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-accent"}
          ${className || ""}
        `}
        aria-disabled={!isOpen}
      >
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2.5.5-5 1.5-7.5A8.1 8.1 0 0112 2.25c1.5 0 2.9.5 4.1 1.5 1.2-.4 2.4-.6 3.6-.6 1.2 0 2.4.2 3.6.6 1.2-1 2.6-1.5 4.1-1.5A8.1 8.1 0 0122 11.25c0 2.5-.5 5-1.5 7.5s-2.9 4.1-4.1 5.1c-.4 1.2-.6 2.4-.6 3.6s.2 2.4.6 3.6c1-1 2.1-1.5 4.1-1.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{canteen.name}</h3>
          <p className="text-xs text-muted-foreground truncate">{canteen.address}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${queueConfig.bg} ${queueConfig.color}`}>
            {queueConfig.label}
          </span>
          <StatusBadge status={isOpen ? OrderStatus.READY : OrderStatus.CANCELLED} size="sm" />
        </div>
      </button>
    );
  }

  return (
    <article
      className={`
        rounded-xl border border-border bg-card overflow-hidden
        ${onClick ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}
        ${className || ""}
      `}
      onClick={onClick}
    >
      <div className="relative h-32 bg-muted overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center justify-between">
            <span className={`
              inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
              ${isOpen ? "bg-green-500/90 text-white" : "bg-destructive/90 text-white"}
            `}>
              {isOpen ? (
                <>
                  <span className="relative inline-flex items-center" aria-hidden="true">
                    <span className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-white/50 animate-ping" />
                    <span className="relative w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                  Open Now
                </>
              ) : (
                "Closed"
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{canteen.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{canteen.address}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="flex items-center gap-2">
              <span className={`
                inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                ${isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}
              `}>
                {isOpen ? "Open" : "Closed"}
              </span>
              {schedule && schedule.isOpen && (
                <span className="text-xs text-muted-foreground">
                  {formatTime(schedule.openTime)} - {formatTime(schedule.closeTime)}
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted">
            <p className="text-xs text-muted-foreground">Queue Load</p>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${queueConfig.bg} ${queueConfig.color}`}>
                {queueConfig.label}
              </span>
              <span className="text-sm font-medium text-foreground">{activeOrdersCount} orders</span>
            </div>
          </div>
        </div>

        {nextPickupSlot && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Next Available Slot</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {new Date(nextPickupSlot.startTime).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })} - {new Date(nextPickupSlot.endTime).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {nextPickupSlot.capacityLimit - nextPickupSlot.reservedCount}/{nextPickupSlot.capacityLimit} spots
              </span>
            </div>
          </div>
        )}

        {onClick && (
          <button
            type="button"
            onClick={onClick}
            disabled={!isOpen}
            className={`
              w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isOpen
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
              }
            `}
            aria-disabled={!isOpen}
          >
            {isOpen ? "View Menu & Order" : "Currently Closed"}
          </button>
        )}
      </div>
    </article>
  );
}

import { StatusBadge } from "@/components/global/status-badge";