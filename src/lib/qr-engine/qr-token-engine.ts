/**
 * SOURCE OF TRUTH KEYWORDS: qr-engine, hmac, sha256, token-generation, single-use, verification, replay-prevention
 * WHAT: Cryptographic QR token engine using HMAC-SHA256 for secure single-use collection verification
 * WHY: Generates tamper-proof, time-limited, single-scan tokens preventing replay attacks and unauthorized collection
 * WHERE: src/lib/qr-engine/qr-token-engine.ts
 */

import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/client";
import { OrderStatus, AuditAction } from "@/lib/types/domain";

const QR_SECRET = process.env.QR_SECRET ?? "qr-secret-change-in-production-min-64-chars";
const QR_TOKEN_TTL_MINUTES = 30;
const QR_TOKEN_BYTES = 32;
const HMAC_ALGORITHM = "sha256";

export interface QRTokenPayload {
  orderId: string;
  studentId: string;
  canteenId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

export interface QRVerificationResult {
  valid: boolean;
  orderId?: string;
  error?: string;
  orderStatus?: OrderStatus;
}

export interface QRTokenData {
  token: string;
  payload: QRTokenPayload;
  hmac: string;
}

function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

function createHMAC(data: string): string {
  return createHmac(HMAC_ALGORITHM, QR_SECRET).update(data).digest("hex");
}

function parseToken(token: string): { payload: QRTokenPayload; hmac: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(".");
    if (parts.length !== 2) return null;
    const payload = JSON.parse(parts[0]) as QRTokenPayload;
    const hmac = parts[1];
    return { payload, hmac };
  } catch {
    return null;
  }
}

export async function generateQRToken(
  orderId: string,
  studentId: string,
  canteenId: string
): Promise<QRTokenData> {
  const now = Date.now();
  const expiresAt = now + QR_TOKEN_TTL_MINUTES * 60 * 1000;
  const nonce = generateNonce();

  const payload: QRTokenPayload = {
    orderId,
    studentId,
    canteenId,
    issuedAt: now,
    expiresAt,
    nonce,
  };

  const payloadString = JSON.stringify(payload);
  const hmac = createHMAC(payloadString);
  const token = Buffer.from(`${payloadString}.${hmac}`).toString("base64url");

  await prisma.order.update({
    where: { id: orderId },
    data: {
      qrToken: token,
      qrExpiresAt: new Date(expiresAt),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: studentId,
      actorRole: "STUDENT",
      action: AuditAction.QR_TOKEN_GENERATED,
      entityType: "Order",
      entityId: orderId,
      canteenId,
      metadata: { expiresAt: new Date(expiresAt).toISOString(), nonce },
    },
  });

  return { token, payload, hmac };
}

export async function verifyQRToken(token: string): Promise<QRVerificationResult> {
  const parsed = parseToken(token);
  if (!parsed) {
    return { valid: false, error: "Invalid token format" };
  }

  const { payload, hmac } = parsed;
  const expectedHMAC = createHMAC(JSON.stringify(payload));

  if (!timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHMAC))) {
    await logFailedVerification(payload.orderId, "HMAC_MISMATCH");
    return { valid: false, error: "Token signature verification failed" };
  }

  const now = Date.now();
  if (now > payload.expiresAt) {
    await logFailedVerification(payload.orderId, "TOKEN_EXPIRED");
    return { valid: false, error: "Token has expired" };
  }

  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    select: { id: true, status: true, qrToken: true, qrExpiresAt: true, canteenId: true, studentId: true },
  });

  if (!order) {
    await logFailedVerification(payload.orderId, "ORDER_NOT_FOUND");
    return { valid: false, error: "Order not found" };
  }

  if (order.qrToken !== token) {
    await logFailedVerification(payload.orderId, "TOKEN_MISMATCH_REPLAY_ATTEMPT");
    return { valid: false, error: "Token has already been used or is invalid" };
  }

  if (order.status !== OrderStatus.READY) {
    await logFailedVerification(payload.orderId, `INVALID_STATUS_${order.status}`);
    return {
      valid: false,
      error: `Order is not ready for collection. Current status: ${order.status}`,
      orderStatus: order.status,
    };
  }

  if (order.qrExpiresAt && now > order.qrExpiresAt.getTime()) {
    await logFailedVerification(payload.orderId, "TOKEN_EXPIRED_DB");
    return { valid: false, error: "Token has expired" };
  }

  return {
    valid: true,
    orderId: order.id,
    orderStatus: order.status,
  };
}

export async function invalidateQRToken(orderId: string, actorId: string, actorRole: string): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: {
      qrToken: null,
      qrExpiresAt: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      actorRole: actorRole as any,
      action: AuditAction.QR_TOKEN_INVALIDATED,
      entityType: "Order",
      entityId: orderId,
      metadata: { invalidatedAt: new Date().toISOString() },
    },
  });
}

export async function markQRTokenVerified(orderId: string, actorId: string, actorRole: string): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId,
      actorRole: actorRole as any,
      action: AuditAction.QR_TOKEN_VERIFIED,
      entityType: "Order",
      entityId: orderId,
      metadata: { verifiedAt: new Date().toISOString() },
    },
  });
}

async function logFailedVerification(orderId: string, reason: string): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: "system",
      actorRole: "STUDENT",
      action: AuditAction.QR_TOKEN_VERIFIED,
      entityType: "Order",
      entityId: orderId,
      metadata: { failed: true, reason, attemptedAt: new Date().toISOString() },
    },
  }).catch(() => {});
}

export function getQRTokenTTLMinutes(): number {
  return QR_TOKEN_TTL_MINUTES;
}

export function isTokenExpired(expiresAt: Date): boolean {
  return Date.now() > expiresAt.getTime();
}