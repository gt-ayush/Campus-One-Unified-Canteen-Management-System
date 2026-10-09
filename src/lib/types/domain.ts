/**
 * SOURCE OF TRUTH KEYWORDS: types, domain, entities, order-status, user-role, payment-status
 * WHAT: Core domain types and enums matching the Prisma schema for type-safe development
 * WHY: Provides single source of truth for domain types used across services, validators, and API layers
 * WHERE: src/lib/types/domain.ts
 */

export enum UserRole {
  STUDENT = "STUDENT",
  MERCHANT_STAFF = "MERCHANT_STAFF",
  ADMIN = "ADMIN",
}

export enum UserStatus {
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  REJECTED = "REJECTED",
}

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  PREPARING = "PREPARING",
  READY = "READY",
  COLLECTED = "COLLECTED",
  CANCELLED = "CANCELLED",
  REJECTED = "REJECTED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
}

export enum PaymentMethod {
  FOOD_PASS = "FOOD_PASS",
  MANUAL_ADMIN = "MANUAL_ADMIN",
  SIMULATED = "SIMULATED",
}

export enum SettlementStatus {
  PENDING = "PENDING",
  CALCULATED = "CALCULATED",
  PAID_OUT = "PAID_OUT",
  DISPUTED = "DISPUTED",
}

export enum AuditAction {
  ORDER_CREATED = "ORDER_CREATED",
  ORDER_CONFIRMED = "ORDER_CONFIRMED",
  ORDER_PREPARING = "ORDER_PREPARING",
  ORDER_READY = "ORDER_READY",
  ORDER_COLLECTED = "ORDER_COLLECTED",
  ORDER_CANCELLED = "ORDER_CANCELLED",
  ORDER_REJECTED = "ORDER_REJECTED",
  STOCK_RESERVED = "STOCK_RESERVED",
  STOCK_RELEASED = "STOCK_RELEASED",
  SLOT_RESERVED = "SLOT_RESERVED",
  SLOT_RELEASED = "SLOT_RELEASED",
  PASS_CREDITS_DEDUCTED = "PASS_CREDITS_DEDUCTED",
  PASS_CREDITS_RESTORED = "PASS_CREDITS_RESTORED",
  PAYMENT_PROCESSED = "PAYMENT_PROCESSED",
  PAYMENT_REFUNDED = "PAYMENT_REFUNDED",
  QR_TOKEN_GENERATED = "QR_TOKEN_GENERATED",
  QR_TOKEN_VERIFIED = "QR_TOKEN_VERIFIED",
  QR_TOKEN_INVALIDATED = "QR_TOKEN_INVALIDATED",
  MERCHANT_PREPARING_MARKED = "MERCHANT_PREPARING_MARKED",
  ADMIN_ACTION = "ADMIN_ACTION",
  SETTLEMENT_CALCULATED = "SETTLEMENT_CALCULATED",
  SETTLEMENT_PAID = "SETTLEMENT_PAID",
  ALTERNATIVE_SUGGESTED = "ALTERNATIVE_SUGGESTED",
  ALTERNATIVE_ACCEPTED = "ALTERNATIVE_ACCEPTED",
  ALTERNATIVE_DECLINED = "ALTERNATIVE_DECLINED",
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface StudentProfile {
  id: string;
  userId: string;
  studentId: string;
  fullName: string;
  phone: string | null;
  campusId: string;
  department: string | null;
  yearOfStudy: number | null;
  isVerified: boolean;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MerchantStaff {
  id: string;
  userId: string;
  canteenId: string;
  fullName: string;
  position: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Canteen {
  id: string;
  name: string;
  description: string | null;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  operatingHours: OperatingHours;
  isApproved: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  commissionRate: number;
  settlementInfo: SettlementInfo;
  createdAt: Date;
  updatedAt: Date;
}

export interface OperatingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface SettlementInfo {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  ifscCode: string;
  upiId?: string;
}

export interface MenuItem {
  id: string;
  canteenId: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  isAvailable: boolean;
  stockQuantity: number;
  maxPerOrder: number;
  imageUrl: string | null;
  dietaryTags: string[];
  preparationTime: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FoodPass {
  id: string;
  studentId: string;
  packageName: string;
  totalCredits: number;
  remainingCredits: number;
  dailyLimit: number;
  validFrom: Date;
  validUntil: Date;
  status: string;
  purchasePrice: number;
  paymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PickupSlot {
  id: string;
  canteenId: string;
  startTime: Date;
  endTime: Date;
  capacityLimit: number;
  reservedCount: number;
  isActive: boolean;
  preparationBuffer: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  orderNumber: string;
  studentId: string;
  canteenId: string;
  pickupSlotId: string;
  foodPassId: string | null;
  status: OrderStatus;
  subtotal: number;
  platformFee: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentId: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  confirmedAt: Date | null;
  preparingAt: Date | null;
  readyAt: Date | null;
  collectedAt: Date | null;
  qrToken: string | null;
  qrExpiresAt: Date | null;
  alternativeOrderId: string | null;
  isAlternative: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  student?: {
    id: string;
    fullName: string;
    studentId: string;
    user?: { id: string; email: string } | null;
  } | null;
  canteen?: {
    id: string;
    name: string;
    address: string;
  } | null;
  pickupSlot?: {
    id: string;
    startTime: Date | string;
    endTime: Date | string;
    capacityLimit: number;
    reservedCount: number;
  } | null;
  items?: Array<OrderItem & { menuItem?: MenuItem | null }> | null;
  payment?: Payment | null;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface OrderListResponse {
  data: Order[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MenuListResponse {
  data: MenuItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CanteenListResponse {
  data: Canteen[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FoodPassListResponse {
  data: FoodPass[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  itemNameSnapshot: string;
  createdAt: Date;
}

export interface Payment {
  id: string;
  orderId: string;
  studentId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionRef: string | null;
  processedAt: Date | null;
  refundedAt: Date | null;
  refundAmount: number;
  refundReason: string | null;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Settlement {
  id: string;
  canteenId: string;
  periodStart: Date;
  periodEnd: Date;
  grossSales: number;
  platformFees: number;
  refundAdjustments: number;
  netPayable: number;
  status: SettlementStatus;
  calculatedAt: Date;
  paidOutAt: Date | null;
  paidOutBy: string | null;
  payoutReference: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: AuditAction;
  entityType: string;
  entityId: string;
  canteenId: string | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  studentProfileId?: string;
  merchantStaffId?: string;
  canteenId?: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: UserRole;
  studentProfileId?: string;
  merchantStaffId?: string;
  canteenId?: string;
  iat: number;
  exp: number;
}