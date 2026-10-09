/**
 * SOURCE OF TRUTH KEYWORDS: api-client, http-client, fetch-wrapper, react-query
 * WHAT: Typed API client with fetch wrapper for type-safe HTTP requests to the backend
 * WHY: Provides consistent error handling, authentication, and type-safe API calls across all frontend components
 * WHERE: src/lib/api/client.ts
 */

import {
  OrderStatus,
  PaymentStatus,
  UserRole,
  UserStatus,
  SettlementStatus,
  AuditAction,
  Order,
  MenuItem,
  Canteen,
  FoodPass,
  PickupSlot,
  OrderListResponse,
  MenuListResponse,
  CanteenListResponse,
  FoodPassListResponse,
} from "@/lib/types/domain";

const API_BASE = "/api/v1";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error", errorCode: "UNKNOWN" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.data as T;
}

function getAuthHeaders(): HeadersInit {
  // In production, this would come from a secure auth context
  return {
    "Content-Type": "application/json",
  };
}

function toSearchParams(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      entries.push([key, String(value)]);
    }
  }
  return new URLSearchParams(entries).toString();
}

export interface CreateOrderRequest {
  canteenId: string;
  pickupSlotId: string;
  items: Array<{ menuItemId: string; quantity: number }>;
  foodPassId?: string;
  notes?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  orderNumber: string;
  alternatives?: Array<{
    menuItemId: string;
    menuItemName: string;
    canteenId: string;
    canteenName: string;
    price: number;
  }>;
}

export interface AlternativesRequest {
  originalCanteenId: string;
  originalMenuItemId: string;
  originalPickupSlotId: string;
  quantity: number;
}

export interface AlternativesResponse {
  alternatives: Array<{
    menuItemId: string;
    menuItemName: string;
    canteenId: string;
    canteenName: string;
    price: number;
  }>;
  originalUnavailable: boolean;
  originalSlotFull: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export const api = {
  // Auth
  auth: {
    login: (email: string, password: string): Promise<LoginResponse> =>
      fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, password }),
      }).then(handleResponse<LoginResponse>),

    register: (data: { role: "STUDENT" | "MERCHANT_STAFF"; [key: string]: string }): Promise<{ id: string }> =>
      fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<{ id: string }>),

    refresh: (): Promise<{ accessToken: string }> =>
      fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: getAuthHeaders(),
      }).then(handleResponse<{ accessToken: string }>),
  },

  // Canteens
  canteens: {
    list: (params?: { page?: number; limit?: number; lat?: number; lng?: number; radius?: number }): Promise<CanteenListResponse> =>
      fetch(`${API_BASE}/canteens?${toSearchParams(params)}`, {
        headers: getAuthHeaders(),
      }).then(handleResponse<CanteenListResponse>),

    get: (id: string): Promise<Canteen> =>
      fetch(`${API_BASE}/canteens/${id}`, { headers: getAuthHeaders() }).then(handleResponse<Canteen>),

    create: (data: { name: string; address: string; phone: string; email: string }): Promise<Canteen> =>
      fetch(`${API_BASE}/canteens`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<Canteen>),

    update: (id: string, data: Partial<Canteen>): Promise<Canteen> =>
      fetch(`${API_BASE}/canteens/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<Canteen>),

    approve: (id: string, action: "approve" | "reject", notes?: string): Promise<{ success: boolean }> =>
      fetch(`${API_BASE}/admin/canteens/${id}/approve`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ action, notes }),
      }).then(handleResponse<{ success: boolean }>),
  },

  // Menu Items
  menu: {
    list: (params?: { canteenId?: string; category?: string; search?: string; page?: number; limit?: number }): Promise<MenuListResponse> =>
      fetch(`${API_BASE}/menu?${toSearchParams(params)}`, {
        headers: getAuthHeaders(),
      }).then(handleResponse<MenuListResponse>),

    get: (id: string): Promise<MenuItem> =>
      fetch(`${API_BASE}/menu/${id}`, { headers: getAuthHeaders() }).then(handleResponse<MenuItem>),

    create: (data: { canteenId: string; name: string; price: number; category: string }): Promise<MenuItem> =>
      fetch(`${API_BASE}/menu`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<MenuItem>),

    update: (id: string, data: Partial<MenuItem>): Promise<MenuItem> =>
      fetch(`${API_BASE}/menu/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<MenuItem>),

    delete: (id: string): Promise<{ success: boolean }> =>
      fetch(`${API_BASE}/menu/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      }).then(handleResponse<{ success: boolean }>),
  },

  // Pickup Slots
  pickupSlots: {
    list: (canteenId: string, params?: { date?: string }): Promise<{ data: PickupSlot[] }> =>
      fetch(`${API_BASE}/pickup-slots?canteenId=${canteenId}&${toSearchParams(params)}`, {
        headers: getAuthHeaders(),
      }).then(handleResponse<{ data: PickupSlot[] }>),

    create: (data: { canteenId: string; startTime: string; endTime: string; capacityLimit: number }): Promise<PickupSlot> =>
      fetch(`${API_BASE}/pickup-slots`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<PickupSlot>),

    update: (id: string, data: Partial<PickupSlot>): Promise<PickupSlot> =>
      fetch(`${API_BASE}/pickup-slots/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<PickupSlot>),

    delete: (id: string): Promise<{ success: boolean }> =>
      fetch(`${API_BASE}/pickup-slots/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      }).then(handleResponse<{ success: boolean }>),
  },

  // Orders
  orders: {
    list: (params?: { page?: number; limit?: number; status?: string; studentId?: string; canteenId?: string }): Promise<OrderListResponse> =>
      fetch(`${API_BASE}/orders?${toSearchParams(params)}`, {
        headers: getAuthHeaders(),
      }).then(handleResponse<OrderListResponse>),

    create: (data: CreateOrderRequest): Promise<CreateOrderResponse> =>
      fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<CreateOrderResponse>),

    get: (id: string): Promise<Order> =>
      fetch(`${API_BASE}/orders/${id}`, { headers: getAuthHeaders() }).then(handleResponse<Order>),

    updateStatus: (id: string, status: OrderStatus, reason?: string): Promise<Order> =>
      fetch(`${API_BASE}/orders/${id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, reason }),
      }).then(handleResponse<Order>),

    getAlternatives: (data: AlternativesRequest): Promise<AlternativesResponse> =>
      fetch(`${API_BASE}/orders/alternatives`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<AlternativesResponse>),

    cancel: (id: string, reason: string): Promise<Order> =>
      fetch(`${API_BASE}/orders/${id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: "CANCELLED", reason }),
      }).then(handleResponse<Order>),
  },

  // Collection
  collection: {
    verify: (token: string): Promise<{ orderId: string; message: string }> =>
      fetch(`${API_BASE}/collection/verify`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ token }),
      }).then(handleResponse<{ orderId: string; message: string }>),
  },

  // Food Passes
  foodPasses: {
    list: (params?: { studentId?: string; status?: string }): Promise<FoodPassListResponse> =>
      fetch(`${API_BASE}/food-passes?${toSearchParams(params)}`, {
        headers: getAuthHeaders(),
      }).then(handleResponse<FoodPassListResponse>),

    create: (data: { studentId: string; packageName: string; totalCredits: number }): Promise<FoodPass> =>
      fetch(`${API_BASE}/food-passes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }).then(handleResponse<FoodPass>),

    get: (id: string): Promise<FoodPass> =>
      fetch(`${API_BASE}/food-passes/${id}`, { headers: getAuthHeaders() }).then(handleResponse<FoodPass>),
  },

  // Merchants
  merchants: {
    list: (params?: { page?: number; limit?: number; status?: string }): Promise<CanteenListResponse> =>
      fetch(`${API_BASE}/merchants?${toSearchParams(params)}`, {
        headers: getAuthHeaders(),
      }).then(handleResponse<CanteenListResponse>),

    get: (id: string): Promise<Canteen> =>
      fetch(`${API_BASE}/merchants/${id}`, { headers: getAuthHeaders() }).then(handleResponse<Canteen>),

    getSettlement: (id: string, params?: { periodStart?: string; periodEnd?: string; action?: string; settlementId?: string; payoutReference?: string }): Promise<Record<string, string | number>> =>
      fetch(`${API_BASE}/merchants/${id}/settlement?${toSearchParams(params)}`, {
        headers: getAuthHeaders(),
      }).then(handleResponse<Record<string, string | number>>),

    calculateSettlement: (id: string, periodStart: string, periodEnd: string): Promise<{ settlementId: string }> =>
      fetch(`${API_BASE}/merchants/${id}/settlement?action=calculate&periodStart=${periodStart}&periodEnd=${periodEnd}`, {
        method: "GET",
        headers: getAuthHeaders(),
      }).then(handleResponse<{ settlementId: string }>),

    payoutSettlement: (settlementId: string, payoutReference: string): Promise<{ success: boolean }> =>
      fetch(`${API_BASE}/merchants/settlement?action=payout&settlementId=${settlementId}&payoutReference=${payoutReference}`, {
        method: "GET",
        headers: getAuthHeaders(),
      }).then(handleResponse<{ success: boolean }>),
  },

  // Health
  health: (): Promise<{ status: string }> =>
    fetch(`${API_BASE}/health`, { headers: getAuthHeaders() }).then(handleResponse<{ status: string }>),
};

export type { OrderStatus, PaymentStatus, UserRole, UserStatus, SettlementStatus, AuditAction };
export type { Order, MenuItem, Canteen, FoodPass, PickupSlot };
