/**
 * SOURCE OF TRUTH KEYWORDS: validators, zod, schemas, api, request, response, validation
 * WHAT: Complete Zod validation schemas for all API endpoints with strict type inference
 * WHY: Ensures runtime validation matching compile-time types, preventing data corruption
 * WHERE: src/lib/validators/schemas.ts
 */

import { z } from "zod";
import { OrderStatus, PaymentStatus, UserRole, UserStatus, SettlementStatus } from "@/lib/types/domain";

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const createOrderSchema = z.object({
  canteenId: uuidSchema,
  pickupSlotId: uuidSchema,
  foodPassId: uuidSchema.optional(),
  items: z
    .array(
      z.object({
        menuItemId: uuidSchema,
        quantity: z.number().int().positive().max(50),
      })
    )
    .min(1, "At least one item required")
    .max(20, "Maximum 20 items per order"),
  notes: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  reason: z.string().max(500).optional(),
});

export const verifyQRSchema = z.object({
  token: z.string().min(1, "QR token required"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerStudentSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  studentId: z.string().min(3).max(50),
  fullName: z.string().min(2).max(100),
  phone: z.string().max(20).optional(),
  campusId: z.string().min(1).max(50),
  department: z.string().max(100).optional(),
  yearOfStudy: z.number().int().min(1).max(10).optional(),
});

export const registerMerchantSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  canteenName: z.string().min(2).max(100),
  canteenAddress: z.string().min(5).max(255),
  canteenPhone: z.string().min(10).max(20),
  canteenEmail: z.string().email("Invalid canteen email"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  operatingHours: z.record(
    z.object({
      isOpen: z.boolean(),
      openTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      closeTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    })
  ),
  settlementInfo: z.object({
    bankName: z.string().min(1),
    accountNumber: z.string().min(1),
    accountHolderName: z.string().min(1),
    ifscCode: z.string().min(1),
    upiId: z.string().optional(),
  }),
});

export const createMenuItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.number().positive().max(10000),
  category: z.string().min(1).max(50),
  stockQuantity: z.number().int().nonnegative().default(0),
  maxPerOrder: z.number().int().positive().max(100).default(10),
  imageUrl: z.string().url().max(500).optional().nullable(),
  dietaryTags: z.array(z.string()).default([]),
  preparationTime: z.number().int().positive().max(120).default(10),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const createPickupSlotSchema = z.object({
  canteenId: uuidSchema,
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  capacityLimit: z.number().int().positive().max(500),
  preparationBuffer: z.number().int().nonnegative().max(60).default(15),
}).refine((data) => data.endTime > data.startTime, {
  message: "End time must be after start time",
  path: ["endTime"],
});

const pickupSlotBaseSchema = z.object({
  canteenId: uuidSchema,
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  capacityLimit: z.number().int().positive().max(500),
  preparationBuffer: z.number().int().nonnegative().max(60).default(15),
});

export const updatePickupSlotSchema = pickupSlotBaseSchema.partial().omit({ canteenId: true }).refine((data) => {
  if (data.startTime && data.endTime) {
    return data.endTime > data.startTime;
  }
  return true;
}, {
  message: "End time must be after start time",
  path: ["endTime"],
});

export const createFoodPassSchema = z.object({
  studentId: uuidSchema,
  packageName: z.string().min(1).max(100),
  totalCredits: z.number().int().positive(),
  dailyLimit: z.number().int().positive(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  purchasePrice: z.number().positive(),
  paymentId: uuidSchema.optional(),
}).refine((data) => data.validUntil > data.validFrom, {
  message: "Valid until must be after valid from",
  path: ["validUntil"],
});

export const settlementQuerySchema = paginationSchema.merge(
  z.object({
    canteenId: uuidSchema.optional(),
    status: z.nativeEnum(SettlementStatus).optional(),
    ...dateRangeSchema.shape,
  })
);

export const orderQuerySchema = paginationSchema.merge(
  z.object({
    studentId: uuidSchema.optional(),
    canteenId: uuidSchema.optional(),
    status: z.nativeEnum(OrderStatus).optional(),
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    ...dateRangeSchema.shape,
  })
);

export const menuQuerySchema = paginationSchema.merge(
  z.object({
    canteenId: uuidSchema.optional(),
    category: z.string().optional(),
    isAvailable: z.coerce.boolean().optional(),
    search: z.string().optional(),
  })
);

export const alternativeRequestSchema = z.object({
  originalCanteenId: uuidSchema,
  originalMenuItemId: uuidSchema,
  originalPickupSlotId: uuidSchema,
  quantity: z.number().int().positive().max(50),
  maxDistanceKm: z.number().positive().max(50).optional(),
  maxPriceDifferencePercent: z.number().positive().max(200).optional(),
  maxTimeDifferenceMinutes: z.number().positive().max(240).optional(),
});

export const canteenRegistrationApprovalSchema = z.object({
  canteenId: uuidSchema,
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(1000).optional(),
});

export const settlementPayoutSchema = z.object({
  settlementId: uuidSchema,
  payoutReference: z.string().min(1).max(100),
});

export const adminUserUpdateSchema = z.object({
  userId: uuidSchema,
  status: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type VerifyQRInput = z.infer<typeof verifyQRSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
export type RegisterMerchantInput = z.infer<typeof registerMerchantSchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type CreatePickupSlotInput = z.infer<typeof createPickupSlotSchema>;
export type UpdatePickupSlotInput = z.infer<typeof updatePickupSlotSchema>;
export type CreateFoodPassInput = z.infer<typeof createFoodPassSchema>;
export type SettlementQueryInput = z.infer<typeof settlementQuerySchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
export type MenuQueryInput = z.infer<typeof menuQuerySchema>;
export type AlternativeRequestInput = z.infer<typeof alternativeRequestSchema>;
export type CanteenRegistrationApprovalInput = z.infer<typeof canteenRegistrationApprovalSchema>;
export type SettlementPayoutInput = z.infer<typeof settlementPayoutSchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    errorCode: z.string().optional(),
    meta: z
      .object({
        page: z.number().optional(),
        limit: z.number().optional(),
        total: z.number().optional(),
        totalPages: z.number().optional(),
      })
      .optional(),
  });

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  errorCode: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ApiResponse = z.infer<ReturnType<typeof apiResponseSchema<z.ZodTypeAny>>>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;