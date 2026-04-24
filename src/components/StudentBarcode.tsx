import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface Props {
  value: string;
  size?: number;
  className?: string;
}

/** Renders a QR code for the given value (typically the student's NIS). */
export const StudentBarcode = ({ value, size = 180, className }: Props) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch((e) => console.error("QR render failed", e));
  }, [value, size]);

  return <canvas ref={ref} className={className} />;
};
