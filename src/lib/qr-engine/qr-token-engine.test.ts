/**
 * SOURCE OF TRUTH KEYWORDS: test, qr-engine, hmac, token, verification, replay, security
 * WHAT: Unit tests for QR token engine verifying HMAC, expiry, replay prevention
 * WHY: Ensures cryptographic token generation and verification works correctly
 * WHERE: src/lib/qr-engine/qr-token-engine.test.ts
 */

import { generateQRToken, verifyQRToken, invalidateQRToken, parseToken, QRTokenPayload } from "./qr-token-engine";
import { OrderStatus } from "@/lib/types/domain";
import { prisma } from "@/lib/db/client";

// Mock Prisma
jest.mock("@/lib/db/client", () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("QR Token Engine", () => {
  const testOrderId = "test-order-123";
  const testStudentId = "student-456";
  const testCanteenId = "canteen-789";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateQRToken", () => {
    it("generates valid token with correct structure", async () => {
      mockPrisma.order.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await generateQRToken(testOrderId, testStudentId, testCanteenId);

      expect(result.token).toBeDefined();
      expect(result.payload).toBeDefined();
      expect(result.hmac).toBeDefined();

      // Verify token structure
      const parsed = parseToken(result.token);
      expect(parsed).not.toBeNull();
      expect(parsed!.payload.orderId).toBe(testOrderId);
      expect(parsed!.payload.studentId).toBe(testStudentId);
      expect(parsed!.payload.canteenId).toBe(testCanteenId);
      expect(parsed!.payload.nonce).toBeDefined();
      expect(parsed!.payload.issuedAt).toBeDefined();
      expect(parsed!.payload.expiresAt).toBeDefined();
    });

    it("sets expiry to 30 minutes from now", async () => {
      mockPrisma.order.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const before = Date.now();
      const result = await generateQRToken(testOrderId, testStudentId, testCanteenId);
      const after = Date.now();

      const parsed = parseToken(result.token)!;
      expect(parsed.payload.expiresAt).toBeGreaterThanOrEqual(before + 29 * 60 * 1000);
      expect(parsed.payload.expiresAt).toBeLessThanOrEqual(after + 31 * 60 * 1000);
    });

    it("creates unique nonce for each token", async () => {
      mockPrisma.order.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const token1 = await generateQRToken(testOrderId, testStudentId, testCanteenId);
      const token2 = await generateQRToken(testOrderId, testStudentId, testCanteenId);

      expect(token1.payload.nonce).not.toBe(token2.payload.nonce);
      expect(token1.token).not.toBe(token2.token);
    });

    it("stores token in database", async () => {
      mockPrisma.order.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await generateQRToken(testOrderId, testStudentId, testCanteenId);

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: testOrderId },
        data: {
          qrToken: result.token,
          qrExpiresAt: expect.any(Date),
        },
      });
    });

    it("creates audit log for token generation", async () => {
      mockPrisma.order.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await generateQRToken(testOrderId, testStudentId, testCanteenId);

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: testStudentId,
          action: "QR_TOKEN_GENERATED",
          entityType: "Order",
          entityId: testOrderId,
          canteenId: testCanteenId,
        }),
      });
    });
  });

  describe("verifyQRToken", () => {
    let validToken: string;
    let validPayload: QRTokenPayload;

    beforeEach(async () => {
      mockPrisma.order.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);
      const result = await generateQRToken(testOrderId, testStudentId, testCanteenId);
      validToken = result.token;
      validPayload = result.payload;
    });

    it("verifies valid token successfully", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: testOrderId,
        status: OrderStatus.READY,
        qrToken: validToken,
        qrExpiresAt: new Date(validPayload.expiresAt),
        canteenId: testCanteenId,
        studentId: testStudentId,
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await verifyQRToken(validToken);

      expect(result.valid).toBe(true);
      expect(result.orderId).toBe(testOrderId);
      expect(result.orderStatus).toBe(OrderStatus.READY);
    });

    it("rejects token with invalid HMAC", async () => {
      // Tamper with the token
      const parts = validToken.split(".");
      const tamperedToken = parts[0] + "." + "invalidsignature";

      const result = await verifyQRToken(tamperedToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token signature verification failed");
    });

    it("rejects expired token", async () => {
      const expiredPayload: QRTokenPayload = {
        ...validPayload,
        expiresAt: Date.now() - 1000, // 1 second ago
      };
      const expiredToken = Buffer.from(
        `${JSON.stringify(expiredPayload)}.invalidsig`
      ).toString("base64url");

      const result = await verifyQRToken(expiredToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token has expired");
    });

    it("rejects token for non-existent order", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      const result = await verifyQRToken(validToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Order not found");
    });

    it("rejects token that doesn't match database (replay prevention)", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: testOrderId,
        status: OrderStatus.READY,
        qrToken: "different-token-in-db",
        qrExpiresAt: new Date(validPayload.expiresAt),
        canteenId: testCanteenId,
        studentId: testStudentId,
      } as any);

      const result = await verifyQRToken(validToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token has already been used or is invalid");
    });

    it("rejects token for order not in READY status", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: testOrderId,
        status: OrderStatus.PREPARING,
        qrToken: validToken,
        qrExpiresAt: new Date(validPayload.expiresAt),
        canteenId: testCanteenId,
        studentId: testStudentId,
      } as any);

      const result = await verifyQRToken(validToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not ready for collection");
      expect(result.orderStatus).toBe(OrderStatus.PREPARING);
    });

    it("rejects malformed token", async () => {
      const result = await verifyQRToken("not-a-valid-token");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid token format");
    });

    it("rejects token with invalid base64", async () => {
      const result = await verifyQRToken("!!!invalid-base64!!!");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid token format");
    });

    it("rejects token with wrong payload structure", async () => {
      const invalidPayload = Buffer.from("invalid-json").toString("base64url");
      const result = await verifyQRToken(invalidPayload + ".sig");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid token format");
    });
  });

  describe("invalidateQRToken", () => {
    it("clears token from database", async () => {
      mockPrisma.order.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await invalidateQRToken(testOrderId, testStudentId, "STUDENT");

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: testOrderId },
        data: { qrToken: null, qrExpiresAt: null },
      });
    });

    it("creates audit log for invalidation", async () => {
      mockPrisma.order.update.mockResolvedValue({} as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await invalidateQRToken(testOrderId, testStudentId, "STUDENT");

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: testStudentId,
          action: "QR_TOKEN_INVALIDATED",
          entityType: "Order",
          entityId: testOrderId,
        }),
      });
    });
  });

  describe("Timing Attack Prevention", () => {
    it("uses timingSafeEqual for HMAC comparison", async () => {
      // This test verifies the implementation uses timingSafeEqual
      // by checking the import is used correctly
      const { timingSafeEqual } = require("crypto");
      const originalTimingSafeEqual = timingSafeEqual;
      
      let called = false;
      require("crypto").timingSafeEqual = (...args: any[]) => {
        called = true;
        return originalTimingSafeEqual(...args);
      };

      mockPrisma.order.findUnique.mockResolvedValue({
        id: testOrderId,
        status: OrderStatus.READY,
        qrToken: validToken,
        qrExpiresAt: new Date(Date.now() + 60000),
        canteenId: testCanteenId,
        studentId: testStudentId,
      } as any);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      // We need to generate a fresh token for this test
      const result = await generateQRToken(testOrderId, testStudentId, testCanteenId);
      await verifyQRToken(result.token);

      expect(called).toBe(true);
      
      require("crypto").timingSafeEqual = originalTimingSafeEqual;
    });
  });
});