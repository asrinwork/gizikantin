import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}

/** Camera barcode scanner for canteen — scans CODE128 / QR / EAN etc. */
export const BarcodeScanner = ({ open, onOpenChange, onDetected }: Props) => {
  const containerId = "barcode-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const start = async () => {
      setStarting(true);
      try {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (cancelled) return;
            onDetected(decodedText);
            stop();
            onOpenChange(false);
          },
          () => {
            // ignore per-frame decode errors
          }
        );
      } catch (e: any) {
        toast.error("Tidak bisa membuka kamera: " + (e?.message ?? e));
        onOpenChange(false);
      } finally {
        setStarting(false);
      }
    };

    const stop = async () => {
      const s = scannerRef.current;
      if (!s) return;
      try {
        if (s.isScanning) await s.stop();
        await s.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    };

    start();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan QR Code Siswa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div
            id={containerId}
            className="w-full overflow-hidden rounded-md bg-muted aspect-square"
          />
          <p className="text-xs text-muted-foreground text-center">
            {starting ? "Memulai kamera..." : "Arahkan kamera ke QR code pada kartu siswa."}
          </p>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
