import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, X } from 'lucide-react';

interface GateEntryQRScanProps {
  /** Fired once with the decoded text (the LR no / DSD-code on the dispatch slip). */
  onScan: (code: string) => void;
  onClose: () => void;
}

const REGION_ID = 'gate-entry-qr-reader';

/**
 * Camera QR scanner for the dispatch-slip QR. Decodes once, stops the
 * camera, and hands the code to the parent (which looks the dispatch up
 * via gateGetDispatchByLr and prefills the gate entry form).
 */
const GateEntryQRScan: React.FC<GateEntryQRScanProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(REGION_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;
          scanner.stop().catch(() => undefined);
          onScan(decodedText.trim());
        },
        () => undefined // per-frame decode misses — not errors
      )
      .catch((err) => {
        setError(
          err?.message?.includes('Permission')
            ? 'Camera permission denied — allow camera access and try again, or type the LR number instead.'
            : 'Could not start the camera. Type the LR number instead.'
        );
      });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <QrCode size={16} className="text-primary" />
            Scan Dispatch Slip QR
          </span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClose}>
            <X size={14} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div id={REGION_ID} className="mx-auto w-full max-w-sm overflow-hidden rounded-md" />
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            Point the camera at the QR on the supplier's dispatch slip — the gate entry form will be prefilled.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default GateEntryQRScan;
