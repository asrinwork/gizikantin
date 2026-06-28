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

// ===== Indeks Massa Tubuh (IMT / BMI) =====
export type BmiCategory = "Sangat Kurus" | "Kurus" | "Normal" | "Gemuk" | "Obesitas";

export const computeBMI = (weightKg?: number | null, heightCm?: number | null): number | null => {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
};

export const bmiCategory = (bmi: number | null | undefined): BmiCategory | null => {
  if (bmi == null || !isFinite(bmi)) return null;
  if (bmi < 17) return "Sangat Kurus";
  if (bmi < 18.5) return "Kurus";
  if (bmi < 25) return "Normal";
  if (bmi < 27) return "Gemuk";
  return "Obesitas";
};

export const bmiBadgeClass = (cat: BmiCategory | null): string => {
  switch (cat) {
    case "Normal": return "bg-success text-success-foreground";
    case "Kurus":
    case "Gemuk": return "bg-warning text-warning-foreground";
    case "Sangat Kurus":
    case "Obesitas": return "bg-destructive text-destructive-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};
