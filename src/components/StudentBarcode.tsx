import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface Props {
  value: string;
  displayValue?: boolean;
  height?: number;
  width?: number;
  fontSize?: number;
  className?: string;
}

/** Renders a CODE128 barcode for the given value (typically the student's NIS). */
export const StudentBarcode = ({
  value,
  displayValue = true,
  height = 60,
  width = 2,
  fontSize = 14,
  className,
}: Props) => {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        displayValue,
        height,
        width,
        fontSize,
        margin: 4,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (e) {
      console.error("Barcode render failed", e);
    }
  }, [value, displayValue, height, width, fontSize]);

  return <svg ref={ref} className={className} />;
};
