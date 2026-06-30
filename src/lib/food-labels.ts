// Klasifikasi NOVA (1..4) dan label gula A/B/C/D

export type NovaClass = 1 | 2 | 3 | 4;

export const NOVA_LABELS: Record<NovaClass, string> = {
  1: "Tidak/Minim Proses",
  2: "Bahan Kuliner Olahan",
  3: "Makanan Olahan",
  4: "Ultra-Processed Food",
};

export const NOVA_OPTIONS: { value: NovaClass; label: string }[] = [
  { value: 1, label: "1 — Tidak/Minim Proses" },
  { value: 2, label: "2 — Bahan Kuliner Olahan" },
  { value: 3, label: "3 — Makanan Olahan" },
  { value: 4, label: "4 — Ultra-Processed Food" },
];

export const novaBadgeClass = (n?: number | null) => {
  switch (n) {
    case 1: return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case 2: return "bg-lime-100 text-lime-800 border-lime-200";
    case 3: return "bg-amber-100 text-amber-800 border-amber-200";
    case 4: return "bg-rose-100 text-rose-800 border-rose-200";
    default: return "bg-muted text-muted-foreground";
  }
};

export type SugarLabel = "A" | "B" | "C" | "D";

export const computeSugarPer100ml = (
  totalSugar?: number | null,
  totalLactose?: number | null,
  servingMl?: number | null,
): number | null => {
  const ts = Number(totalSugar);
  const tl = Number(totalLactose) || 0;
  const v = Number(servingMl);
  if (!isFinite(ts) || !isFinite(v) || v <= 0) return null;
  const val = (ts - tl) * (100 / v);
  return Math.max(0, Math.round(val * 100) / 100);
};

export const sugarLabelFromValue = (v: number | null | undefined): SugarLabel | null => {
  if (v == null || !isFinite(v)) return null;
  if (v <= 1) return "A";
  if (v <= 5) return "B";
  if (v <= 10) return "C";
  return "D";
};

export const sugarLabelMeta: Record<SugarLabel, { name: string; badgeClass: string; dotClass: string }> = {
  A: { name: "Sangat Dianjurkan", badgeClass: "bg-green-500 text-white border-green-600",       dotClass: "bg-green-500" },
  B: { name: "Dianjurkan",        badgeClass: "bg-green-300 text-green-900 border-green-400",   dotClass: "bg-green-300" },
  C: { name: "Dibatasi",          badgeClass: "bg-yellow-400 text-yellow-900 border-yellow-500",dotClass: "bg-yellow-400" },
  D: { name: "Dilarang",          badgeClass: "bg-red-500 text-white border-red-600",           dotClass: "bg-red-500" },
};
