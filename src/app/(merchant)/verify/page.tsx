/**
 * SOURCE OF TRUTH KEYWORDS: merchant-verify, qr-verification, collection-scanner, merchant-ui
 * WHAT: Merchant QR verification page for scanning and validating student QR codes for order collection
 * WHY: Provides merchants with a dedicated page to verify student QR codes and mark orders as collected
 * WHERE: src/app/(merchant)/verify/page.tsx
 */

"use client";

import { QRScanner } from "./_components/qr-scanner";

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">QR Verification</h1>
              <p className="text-muted-foreground text-sm">Scan student QR codes to verify order collection</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <QRScanner />
      </main>
    </div>
  );
}