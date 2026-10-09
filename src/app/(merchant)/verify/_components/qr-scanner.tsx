/**
 * SOURCE OF TRUTH KEYWORDS: qr-scanner, qr-verification, collection-scanner, merchant-ui, single-use-token
 * WHAT: QR verification scanner component for merchants to validate collection tokens, mark orders collected, and invalidate token replays
 * WHY: Provides merchants with a scanner interface to verify student QR codes and mark orders as collected
 * WHERE: src/app/(merchant)/verify/_components/qr-scanner.tsx
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useVerifyCollection } from "@/lib/hooks/use-queries";
import { OrderStatus } from "@/lib/types/domain";

interface QRScannerProps {
  className?: string;
}

type ScannerMode = "camera" | "manual";

interface VerificationResult {
  success: boolean;
  orderId?: string;
  message?: string;
  error?: string;
  orderStatus?: OrderStatus;
}

export function QRScanner({ className }: QRScannerProps) {
  const [mode, setMode] = useState<ScannerMode>("camera");
  const [isScanning, setIsScanning] = useState(false);
  const [scannedToken, setScannedToken] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  const verifyMutation = useVerifyCollection();

  const startCamera = useCallback(async () => {
    try {
      setPermissionDenied(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
        scanFrame();
      }
    } catch (err) {
      setPermissionDenied(true);
      setError("Camera access denied. Please use manual entry or grant camera permission.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsScanning(false);
  }, []);

  const scanFrame = useCallback(() => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = decodeQRCode(imageData);

      if (code) {
        setScannedToken(code);
        handleVerify(code);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [isScanning]);

  const handleVerify = async (token: string) => {
    setError(null);
    try {
      const response = await fetch("/api/v1/collection/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          orderId: data.data.orderId,
          message: data.data.message,
        });
        setScannedToken("");
        stopCamera();
      } else {
        setError(data.error || "Verification failed");
        setResult({
          success: false,
          error: data.error,
          orderStatus: data.orderStatus,
        });
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
    }
  };

  const handleManualVerify = async () => {
    if (!scannedToken.trim()) {
      setError("Please enter a QR token");
      return;
    }
    setError(null);
    await handleVerify(scannedToken.trim());
  };

  const resetResult = () => {
    setResult(null);
    setError(null);
    setScannedToken("");
  };

  const switchMode = (newMode: ScannerMode) => {
    setMode(newMode);
    if (newMode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    resetResult();
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stopCamera]);

  function decodeQRCode(_imageData: ImageData): string | null {
    // Simple QR code detection - in production, use a proper library like jsQR
    // This is a placeholder - real implementation would use jsQR or similar
    return null;
  }

  return (
    <div className={`bg-card rounded-xl border border-border overflow-hidden ${className || ""}`}>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">QR Verification Scanner</h2>
            <p className="text-sm text-muted-foreground">Scan student QR codes to verify order collection</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              isScanning ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
            }`}>
              {isScanning ? "Scanning Active" : "Camera Off"}
            </span>
          </div>
        </div>

        <div className="flex gap-4 mb-4" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "camera"}
            onClick={() => switchMode("camera")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "camera"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h.09M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Camera Scan
          </button>
          <button
            role="tab"
            aria-selected={mode === "manual"}
            onClick={() => switchMode("manual")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === "manual"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zM11 20a2 2 0 114 0v1a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1M11 12a2 2 0 114 0v2a1 1 0 01-1 1h-3a1 1 0 01-1-1v-2z" />
            </svg>
            Manual Entry
          </button>
        </div>
      </div>

      {mode === "camera" && (
        <div className="relative aspect-square bg-muted rounded-xl overflow-hidden">
          {permissionDenied ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-muted/50">
              <svg className="w-16 h-16 text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <h3 className="text-lg font-medium text-foreground mb-2">Camera Access Denied</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs text-center">
                Please enable camera access in your browser settings or use manual entry.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => switchMode("manual")}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90"
                >
                  Use Manual Entry
                </button>
                <button
                  onClick={() => { setPermissionDenied(false); startCamera(); }}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg"
                >
                  Retry Camera
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                autoPlay
                muted
                aria-hidden="true"
              />
              <canvas ref={canvasRef} className="hidden" />

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-64">
                  <svg className="w-full h-full text-primary/50" viewBox="0 0 100 100" aria-hidden="true">
                    <rect x="10" y="10" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="3" rx="8" />
                    <rect x="15" y="15" width="20" height="20" fill="currentColor" />
                    <rect x="65" y="15" width="20" height="20" fill="currentColor" />
                    <rect x="15" y="65" width="20" height="20" fill="currentColor" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-primary/30 rounded-lg animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">
                <p className="text-sm text-white/80 bg-black/50 px-4 py-2 rounded-lg">
                  Position QR code within the frame
                </p>
              </div>

              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-0" />
            </>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-destructive/90 text-destructive-foreground rounded-lg text-sm shadow-lg animate-in slide-in-from-top-2">
              {error}
            </div>
          )}
        </div>
      )}

      {mode === "manual" && (
        <div className="space-y-4 max-w-md mx-auto">
          <div className="text-center py-8">
            <svg className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-foreground mb-2">Enter QR Token</h3>
            <p className="text-sm text-muted-foreground">Paste or type the QR token from the student's device</p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="qr-token" className="block text-sm font-medium text-foreground mb-2">
                QR Token
              </label>
              <textarea
                id="qr-token"
                value={scannedToken}
                onChange={e => setScannedToken(e.target.value)}
                placeholder="Paste QR token here..."
                className="w-full min-h-[100px] p-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleManualVerify}
                disabled={verifyMutation.isPending || !scannedToken.trim()}
                className="flex-1 px-4 py-3 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifyMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Verifying...
                  </span>
                ) : (
                  "Verify & Collect"
                )}
              </button>
              <button
                onClick={() => { setScannedToken(""); setResult(null); setError(null); }}
                className="px-4 py-3 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                Clear
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {(result || error) && (
        <div className={`p-6 rounded-xl border ${
          result?.success ? "bg-green-50 border-green-200" :
          result?.success === false || error ? "bg-destructive-50 border-destructive-200" :
          "bg-amber-50 border-amber-200"
        }`}>
          {result?.success && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">Collection Verified</h3>
              <p className="text-sm text-green-700 mb-2">{result.message || "Order collected successfully"}</p>
              <div className="text-sm text-green-700 font-mono">{result.orderId}</div>
            </div>
          )}

          {(result?.success === false || error) && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-destructive mb-2">Verification Failed</h3>
              <p className="text-sm text-destructive mb-4">{result?.error || error}</p>
              {result?.orderStatus && (
                <p className="text-sm text-muted-foreground">
                  Order status: <span className="font-medium capitalize">{result.orderStatus.toLowerCase()}</span>
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={() => { setResult(null); setError(null); setScannedToken(""); }}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90"
            >
              Scan Another
            </button>
            <button
              onClick={() => { setResult(null); setError(null); }}
              className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}