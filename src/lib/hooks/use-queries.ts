/**
 * SOURCE OF TRUTH KEYWORDS: react-query, hooks, data-fetching, caching, optimistic-updates
 * WHAT: React Query hooks for type-safe data fetching, caching, and optimistic updates
 * WHY: Provides consistent data fetching patterns with automatic caching, background updates, and optimistic UI
 * WHERE: src/lib/hooks/use-queries.ts
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { OrderStatus } from "@/lib/types/domain";

export function useCanteens(params?: { page?: number; limit?: number; lat?: number; lng?: number; radius?: number }) {
  return useQuery({
    queryKey: ["canteens", params],
    queryFn: () => api.canteens.list(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCanteen(id: string) {
  return useQuery({
    queryKey: ["canteen", id],
    queryFn: () => api.canteens.get(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMenuItems(canteenId: string, params?: { category?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["menu", canteenId, params],
    queryFn: () => api.menu.list({ canteenId, ...params }),
    enabled: !!canteenId,
    staleTime: 2 * 60 * 1000,
  });
}

export function usePickupSlots(canteenId: string, date?: string) {
  return useQuery({
    queryKey: ["pickup-slots", canteenId, date],
    queryFn: () => api.pickupSlots.list(canteenId, date ? { date } : undefined),
    enabled: !!canteenId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useOrders(params?: { page?: number; limit?: number; status?: OrderStatus; studentId?: string; canteenId?: string }) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => api.orders.list(params),
    staleTime: 30 * 1000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: () => api.orders.get(id),
    enabled: !!id,
    staleTime: 15 * 1000,
  });
}

export function useFoodPasses(params?: { studentId?: string; status?: string }) {
  return useQuery({
    queryKey: ["food-passes", params],
    queryFn: () => api.foodPasses.list(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMerchants(params?: { page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ["merchants", params],
    queryFn: () => api.merchants.list(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMerchant(id: string) {
  return useQuery({
    queryKey: ["merchant", id],
    queryFn: () => api.merchants.get(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSettlement(canteenId: string, params?: { periodStart?: string; periodEnd?: string }) {
  return useQuery({
    queryKey: ["settlement", canteenId, params],
    queryFn: () => api.merchants.getSettlement(canteenId, params),
    enabled: !!canteenId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.orders.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["food-passes"] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: OrderStatus; reason?: string }) =>
      api.orders.updateStatus(id, status, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", variables.id] });
    },
  });
}

export function useVerifyCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.collection.verify(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useMenuMutations() {
  const queryClient = useQueryClient();
  return {
    create: useMutation({
      mutationFn: api.menu.create,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: any }) => api.menu.update(id, data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
    }),
    delete: useMutation({
      mutationFn: (id: string) => api.menu.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu"] }),
    }),
  };
}

export function usePickupSlotMutations() {
  const queryClient = useQueryClient();
  return {
    create: useMutation({
      mutationFn: api.pickupSlots.create,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pickup-slots"] }),
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: any }) => api.pickupSlots.update(id, data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pickup-slots"] }),
    }),
    delete: useMutation({
      mutationFn: (id: string) => api.pickupSlots.delete(id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pickup-slots"] }),
    }),
  };
}

export function useGetAlternatives() {
  return useMutation({
    mutationFn: api.orders.getAlternatives,
  });
}

export function useCalculateSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ canteenId, periodStart, periodEnd }: { canteenId: string; periodStart: string; periodEnd: string }) =>
      api.merchants.calculateSettlement(canteenId, periodStart, periodEnd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlement"] });
    },
  });
}

export function usePayoutSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ settlementId, payoutReference }: { settlementId: string; payoutReference: string }) =>
      api.merchants.payoutSettlement(settlementId, payoutReference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlement"] });
    },
  });
}