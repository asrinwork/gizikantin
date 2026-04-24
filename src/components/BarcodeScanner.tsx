import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}

/** Camera QR scanner for canteen — scans QR codes on student cards. */
export const BarcodeScanner = ({ open, onOpenChange, onDetected }: Props) => {
  const containerId = "barcode-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const waitForEl = async (): Promise<HTMLElement | null> => {
      // Poll up to ~2s for the dialog content (and our container) to mount
      for (let i = 0; i < 40; i++) {
        const el = document.getElementById(containerId);
        if (el) return el;
        await new Promise((r) => setTimeout(r, 50));
      }
      return null;
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

    const start = async () => {
      setStarting(true);
      try {
        const el = await waitForEl();
        if (cancelled) return;
        if (!el) {
          toast.error("Tidak bisa memuat tampilan kamera. Coba lagi.");
          onOpenChange(false);
          return;
        }

        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        const containerEl = document.getElementById(containerId);
        const boxSize = containerEl
          ? Math.round(Math.min(containerEl.clientWidth, containerEl.clientHeight) * 0.75)
          : 240;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: boxSize, height: boxSize } },
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
        if (!cancelled) {
          toast.error("Tidak bisa membuka kamera: " + (e?.message ?? e));
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
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
          <DialogDescription>
            Arahkan kamera ke QR code pada kartu siswa untuk memilih siswa secara otomatis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div
            id={containerId}
            ref={containerRef}
            className="w-full overflow-hidden rounded-md bg-muted aspect-square"
          />
          <p className="text-xs text-muted-foreground text-center">
            {starting ? "Memulai kamera..." : "Pastikan QR code terlihat jelas dalam bingkai."}
          </p>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
