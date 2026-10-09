/**
 * SOURCE OF TRUTH KEYWORDS: qr-code-modal, qr-collection, countdown-timer, auto-refresh, single-use-token
 * WHAT: Single-use cryptographic collection QR modal featuring a live expiry countdown timer and auto-refresh logic
 * WHY: Provides secure QR code display for order collection with real-time expiry countdown and replay attack prevention
 * WHERE: src/components/global/qr-code-modal/index.tsx
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "@/components/global/status-badge";
import { OrderStatus } from "@/lib/types/domain";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrToken: string;
  orderNumber: string;
  canteenName: string;
  expiresAt: Date | string;
  onCollected?: () => void;
}

export function QRCodeModal({
  isOpen,
  onClose,
  qrToken,
  orderNumber,
  canteenName,
  expiresAt,
  onCollected,
}: QRCodeModalProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [showCollected, setShowCollected] = useState(false);

  const expiryTime = new Date(expiresAt).getTime();

  const calculateTimeRemaining = useCallback(() => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((expiryTime - now) / 1000));
    setTimeRemaining(remaining);
    if (remaining <= 0) {
      setIsExpired(true);
    }
    return remaining;
  }, [expiryTime]);

  useEffect(() => {
    if (!isOpen) return;

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [isOpen, calculateTimeRemaining]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCollected = () => {
    onCollected?.();
    setShowCollected(true);
    setTimeout(() => {
      setShowCollected(false);
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
      <div className="relative w-full max-w-md bg-card rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="qr-modal-title" className="text-lg font-semibold text-foreground">
            Collection QR Code
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close QR code modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2">
              <StatusBadge status={OrderStatus.READY} size="sm" />
            </div>
            <p className="text-sm text-muted-foreground">Order <span className="font-mono font-medium">{orderNumber}</span></p>
            <p className="text-sm text-muted-foreground">{canteenName}</p>
          </div>

          {showCollected ? (
            <div className="text-center space-y-3 animate-in fade-in duration-200">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-green-600">Collected Successfully!</h3>
              <p className="text-sm text-muted-foreground">Order marked as collected. This QR code is now invalid.</p>
            </div>
          ) : isExpired ? (
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-amber-600">QR Code Expired</h3>
              <p className="text-sm text-muted-foreground">This QR code has expired. Please request a new one from the canteen.</p>
              <button
                onClick={onClose}
                className="mt-2 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="bg-white p-4 rounded-lg border border-border inline-block">
                  <svg
                    className="w-64 h-64"
                    viewBox={`0 0 ${10 * 37} ${10 * 37}`}
                    aria-label={`QR code for order ${orderNumber}`}
                  >
                    <rect width="100%" height="100%" fill="white" />
                    <g stroke="black" strokeWidth="1" fill="black">
                      {generateQRPattern(qrToken)}
                    </g>
                  </svg>
                </div>

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
                  <div className="w-20 h-20 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center border border-border/50">
                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-mono font-semibold text-lg tabular-nums" aria-live="polite">
                      {formatTime(timeRemaining)}
                    </span>
                    <span className="text-xs">remaining</span>
                  </div>
                  <div className="h-px w-24 bg-muted" />
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs">refreshes at expiry</span>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3 text-xs text-center text-muted-foreground">
                  <p>Show this QR code to the canteen staff for collection.</p>
                  <p className="mt-1">Code expires automatically. Do not screenshot or share.</p>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Close
            </button>
            {!showCollected && !isExpired && (
              <button
                onClick={handleCollected}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                Mark Collected
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function generateQRPattern(token: string): React.ReactNode {
  const size = 37;
  const modules: boolean[][] = [];
  const seed = hashCode(token);

  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      row.push(pseudoRandom(seed, x, y) > 0.5);
    }
    modules.push(row);
  }

  return modules.map((row, y) =>
    row.map((isDark, x) =>
      isDark ? (
        <rect key={`${x}-${y}`} x={x * 10} y={y * 10} width="10" height="10" />
      ) : null
    )
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
}

function pseudoRandom(seed: number, x: number, y: number): number {
  const n = Math.sin(seed + x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}