import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

export interface BarcodeStudent {
  nis: string;
  full_name: string;
  class_name: string;
}

/** Generate a single PNG dataURL barcode for a value (CODE128). */
const makeBarcodeDataUrl = (value: string): string => {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, {
    format: "CODE128",
    displayValue: true,
    height: 60,
    width: 2,
    fontSize: 14,
    margin: 4,
    background: "#ffffff",
    lineColor: "#000000",
  });
  return canvas.toDataURL("image/png");
};

/** Download a single student's barcode as PNG. */
export const downloadStudentBarcodePNG = (s: BarcodeStudent) => {
  const url = makeBarcodeDataUrl(s.nis);
  const a = document.createElement("a");
  a.href = url;
  a.download = `barcode-${s.nis}-${s.full_name.replace(/\s+/g, "_")}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/**
 * Generate a printable PDF (A4) containing barcodes for every student.
 * Layout: 2 columns × 5 rows = 10 cards per page.
 */
export const downloadBulkBarcodesPDF = (students: BarcodeStudent[]) => {
  if (students.length === 0) return;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297
  const margin = 10;
  const cols = 2;
  const rows = 5;
  const cardW = (pageW - margin * 2) / cols;
  const cardH = (pageH - margin * 2) / rows;

  students.forEach((s, idx) => {
    const onPage = idx % (cols * rows);
    if (idx > 0 && onPage === 0) pdf.addPage();
    const col = onPage % cols;
    const row = Math.floor(onPage / cols);
    const x = margin + col * cardW;
    const y = margin + row * cardH;

    // Card border
    pdf.setDrawColor(200);
    pdf.roundedRect(x + 2, y + 2, cardW - 4, cardH - 4, 2, 2);

    // Header text
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(s.full_name, x + cardW / 2, y + 9, { align: "center", maxWidth: cardW - 8 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`Kelas ${s.class_name}`, x + cardW / 2, y + 15, { align: "center" });

    // Barcode image
    const dataUrl = makeBarcodeDataUrl(s.nis);
    const imgW = cardW - 20;
    const imgH = cardH - 30;
    pdf.addImage(dataUrl, "PNG", x + 10, y + 18, imgW, imgH - 6);
  });

  pdf.save(`barcode-siswa-${new Date().toISOString().slice(0, 10)}.pdf`);
};
