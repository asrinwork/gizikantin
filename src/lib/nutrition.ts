export type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
};

export type NutritionTarget = NutritionTotals;

export type NutritionStatus = "kurang" | "ideal" | "berlebih";

export const computeStatus = (consumed: number, target: number): NutritionStatus => {
  if (target <= 0) return "ideal";
  const pct = (consumed / target) * 100;
  if (pct < 80) return "kurang";
  if (pct > 110) return "berlebih";
  return "ideal";
};

export const overallStatus = (totals: NutritionTotals, target: NutritionTarget): NutritionStatus => {
  // status berdasarkan kalori (paling representatif)
  return computeStatus(totals.calories, target.calories);
};

export const statusLabel = (s: NutritionStatus) =>
  s === "ideal" ? "Ideal" : s === "kurang" ? "Kurang" : "Berlebih";

export const statusColor = (s: NutritionStatus) =>
  s === "ideal"
    ? "bg-success text-success-foreground"
    : s === "kurang"
    ? "bg-warning text-warning-foreground"
    : "bg-destructive text-destructive-foreground";

export const statusEmoji = (s: NutritionStatus) =>
  s === "ideal" ? "✅" : s === "kurang" ? "⚠️" : "❌";

export const formatNum = (n: number, digits = 1) =>
  Number(n ?? 0).toLocaleString("id-ID", { maximumFractionDigits: digits });
