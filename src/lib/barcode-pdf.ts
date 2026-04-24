import jsPDF from "jspdf";
import QRCode from "qrcode";

export interface BarcodeStudent {
  nis: string;
  full_name: string;
  class_name: string;
}

const makeQrDataUrl = async (value: string, size = 256): Promise<string> => {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
};

/** Download a single student's QR code as PNG. */
export const downloadStudentBarcodePNG = async (s: BarcodeStudent) => {
  const url = await makeQrDataUrl(s.nis, 512);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qr-${s.nis}-${s.full_name.replace(/\s+/g, "_")}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/**
 * Generate a printable PDF (A4) containing QR codes for every student.
 * Layout: 3 columns × 4 rows = 12 cards per page.
 */
export const downloadBulkBarcodesPDF = async (students: BarcodeStudent[]) => {
  if (students.length === 0) return;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297
  const margin = 10;
  const cols = 3;
  const rows = 4;
  const cardW = (pageW - margin * 2) / cols;
  const cardH = (pageH - margin * 2) / rows;

  // Pre-generate QR data URLs in parallel
  const qrUrls = await Promise.all(students.map((s) => makeQrDataUrl(s.nis, 512)));

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
    pdf.setFontSize(10);
    pdf.text(s.full_name, x + cardW / 2, y + 8, { align: "center", maxWidth: cardW - 6 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`Kelas ${s.class_name}`, x + cardW / 2, y + 13, { align: "center" });

    // QR image (square, centered)
    const qrSize = Math.min(cardW, cardH) - 22;
    const qrX = x + (cardW - qrSize) / 2;
    const qrY = y + 16;
    pdf.addImage(qrUrls[idx], "PNG", qrX, qrY, qrSize, qrSize);

    // NIS at bottom
    pdf.setFontSize(8);
    pdf.text(`NIS: ${s.nis}`, x + cardW / 2, y + cardH - 4, { align: "center" });
  });

  pdf.save(`qrcode-siswa-${new Date().toISOString().slice(0, 10)}.pdf`);
};
