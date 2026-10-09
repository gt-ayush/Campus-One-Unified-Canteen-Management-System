/**
 * SOURCE OF TRUTH KEYWORDS: recommendation, alternative, canteen, suggestion, algorithm, consent, stock, capacity
 * WHAT: Alternative canteen recommendation engine with user consent enforcement and multi-factor scoring
 * WHY: Suggests viable alternatives when items are unavailable or slots are full, never silently redirects orders
 * WHERE: src/lib/recommendation/alternative-engine.ts
 */

import "server-only";
import { prisma } from "@/lib/db/client";
import { MenuItem, Canteen, PickupSlot, OrderStatus } from "@/lib/types/domain";

export interface AlternativeRequest {
  studentId: string;
  originalCanteenId: string;
  originalMenuItemId: string;
  originalPickupSlotId: string;
  quantity: number;
  maxDistanceKm?: number;
  maxPriceDifferencePercent?: number;
  maxTimeDifferenceMinutes?: number;
}

export interface AlternativeSuggestion {
  canteenId: string;
  canteenName: string;
  canteenAddress: string;
  distanceKm: number | null;
  menuItemId: string;
  menuItemName: string;
  price: number;
  priceDifference: number;
  priceDifferencePercent: number;
  pickupSlotId: string;
  pickupSlotStart: Date;
  pickupSlotEnd: Date;
  timeDifferenceMinutes: number;
  availableStock: number;
  availableCapacity: number;
  matchScore: number;
  reason: string;
}

export interface RecommendationResult {
  alternatives: AlternativeSuggestion[];
  originalUnavailable: boolean;
  originalSlotFull: boolean;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateMatchScore(
  suggestion: Partial<AlternativeSuggestion>,
  request: AlternativeRequest
): number {
  let score = 100;

  if (suggestion.distanceKm !== null && suggestion.distanceKm !== undefined) {
    score -= Math.min(suggestion.distanceKm * 5, 30);
  }

  if (suggestion.priceDifferencePercent !== null && suggestion.priceDifferencePercent !== undefined) {
    score -= Math.min(Math.abs(suggestion.priceDifferencePercent) * 0.5, 20);
  }

  if (suggestion.timeDifferenceMinutes !== null && suggestion.timeDifferenceMinutes !== undefined) {
    score -= Math.min(suggestion.timeDifferenceMinutes * 0.5, 15);
  }

  if (suggestion.availableStock !== null && suggestion.availableStock !== undefined) {
    if (suggestion.availableStock < request.quantity) {
      score -= 25;
    }
  }

  if (suggestion.availableCapacity !== null && suggestion.availableCapacity !== undefined) {
    if (suggestion.availableCapacity < request.quantity) {
      score -= 25;
    }
  }

  return Math.max(0, Math.round(score));
}

export async function findAlternatives(
  request: AlternativeRequest
): Promise<RecommendationResult> {
  const maxDistance = request.maxDistanceKm ?? 5;
  const maxPriceDiff = request.maxPriceDifferencePercent ?? 50;
  const maxTimeDiff = request.maxTimeDifferenceMinutes ?? 60;

  const originalItem = await prisma.menuItem.findUnique({
    where: { id: request.originalMenuItemId },
    include: { canteen: true },
  });

  const originalSlot = await prisma.pickupSlot.findUnique({
    where: { id: request.originalPickupSlotId },
  });

  if (!originalItem || !originalSlot) {
    return { alternatives: [], originalUnavailable: true, originalSlotFull: true };
  }

  const originalCanteen = await prisma.canteen.findUnique({
    where: { id: request.originalCanteenId },
  });

  const isItemUnavailable = !originalItem.isAvailable || originalItem.stockQuantity < request.quantity;
  const isSlotFull = originalSlot.reservedCount >= originalSlot.capacityLimit;

  if (!isItemUnavailable && !isSlotFull) {
    return { alternatives: [], originalUnavailable: false, originalSlotFull: false };
  }

  const candidateItems = await prisma.menuItem.findMany({
    where: {
      id: { not: request.originalMenuItemId },
      name: { contains: originalItem.name.split(" ")[0], mode: "insensitive" },
      isAvailable: true,
      stockQuantity: { gte: request.quantity },
      canteen: {
        isApproved: true,
        id: { not: request.originalCanteenId },
      },
    },
    include: {
      canteen: {
        include: {
          pickupSlots: {
            where: {
              isActive: true,
              startTime: {
                gte: new Date(originalSlot.startTime.getTime() - maxTimeDiff * 60 * 1000),
                lte: new Date(originalSlot.startTime.getTime() + maxTimeDiff * 60 * 1000),
              },
              reservedCount: { lt: prisma.pickupSlot.fields.capacityLimit },
            },
            take: 5,
          },
        },
      },
    },
    take: 20,
  });

  const suggestions: AlternativeSuggestion[] = [];

  for (const item of candidateItems) {
    const priceDiff = item.price - originalItem.price;
    const priceDiffPercent = ((priceDiff / originalItem.price) * 100);
    if (Math.abs(priceDiffPercent) > maxPriceDiff) continue;

    for (const slot of item.canteen.pickupSlots) {
      const timeDiff = Math.abs(
        (slot.startTime.getTime() - originalSlot.startTime.getTime()) / (1000 * 60)
      );
      if (timeDiff > maxTimeDiff) continue;

      let distance: number | null = null;
      if (originalCanteen && item.canteen.latitude && item.canteen.longitude) {
        distance = haversineDistance(
          Number(originalCanteen.latitude),
          Number(originalCanteen.longitude),
          Number(item.canteen.latitude),
          Number(item.canteen.longitude)
        );
        if (distance > maxDistance) continue;
      }

      const availableCapacity = slot.capacityLimit - slot.reservedCount;
      if (availableCapacity < request.quantity) continue;

      const suggestion: AlternativeSuggestion = {
        canteenId: item.canteen.id,
        canteenName: item.canteen.name,
        canteenAddress: item.canteen.address,
        distanceKm: distance,
        menuItemId: item.id,
        menuItemName: item.name,
        price: Number(item.price),
        priceDifference: Number(priceDiff),
        priceDifferencePercent: Number(priceDiffPercent),
        pickupSlotId: slot.id,
        pickupSlotStart: slot.startTime,
        pickupSlotEnd: slot.endTime,
        timeDifferenceMinutes: timeDiff,
        availableStock: item.stockQuantity,
        availableCapacity,
        matchScore: 0,
        reason: buildReason(isItemUnavailable, isSlotFull, distance, priceDiffPercent, timeDiff),
      };

      suggestion.matchScore = calculateMatchScore(suggestion, request);
      suggestions.push(suggestion);
    }
  }

  suggestions.sort((a, b) => b.matchScore - a.matchScore);

  return {
    alternatives: suggestions.slice(0, 5),
    originalUnavailable: isItemUnavailable,
    originalSlotFull: isSlotFull,
  };
}

function buildReason(
  itemUnavailable: boolean,
  slotFull: boolean,
  distance: number | null,
  priceDiffPercent: number,
  timeDiff: number
): string {
  const reasons: string[] = [];
  if (itemUnavailable) reasons.push("Item unavailable at original canteen");
  if (slotFull) reasons.push("Original pickup slot full");
  if (distance !== null) reasons.push(`${distance.toFixed(1)}km away`);
  if (priceDiffPercent !== 0) {
    const direction = priceDiffPercent > 0 ? "more expensive" : "cheaper";
    reasons.push(`${Math.abs(priceDiffPercent).toFixed(0)}% ${direction}`);
  }
  if (timeDiff > 0) reasons.push(`${Math.round(timeDiff)}min time difference`);
  return reasons.join("; ");
}

export async function recordAlternativeDecision(
  originalOrderId: string,
  suggestedAlternativeId: string | null,
  accepted: boolean,
  studentId: string
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: studentId,
      actorRole: "STUDENT",
      action: accepted ? "ALTERNATIVE_ACCEPTED" : "ALTERNATIVE_DECLINED",
      entityType: "Order",
      entityId: originalOrderId,
      metadata: {
        suggestedAlternativeId,
        accepted,
        decidedAt: new Date().toISOString(),
      },
    },
  });
}