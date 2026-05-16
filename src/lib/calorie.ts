// Mifflin-St Jeor BMR + activity factors + macro distribution
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Tidak aktif (jarang olahraga)",
  light: "Ringan (1-3x/minggu)",
  moderate: "Sedang (3-5x/minggu)",
  active: "Aktif (6-7x/minggu)",
  very_active: "Sangat aktif (atlet)",
};

const FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

export const ageFromBirthdate = (birthDate: string | null | undefined): number => {
  if (!birthDate) return 12;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return Math.max(5, age);
};

export interface DailyTarget {
  calories: number; protein: number; carbs: number; fat: number; sugar: number;
}

export const calcDailyTarget = (p: {
  gender?: "L" | "P" | null;
  birth_date?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  activity_level?: ActivityLevel | null;
}, fallback: DailyTarget = { calories: 2000, protein: 50, carbs: 275, fat: 65, sugar: 50 }): DailyTarget => {
  const { gender, birth_date, height_cm, weight_kg, activity_level } = p;
  if (!height_cm || !weight_kg || !birth_date) return fallback;
  const age = ageFromBirthdate(birth_date);
  const bmr = gender === "P"
    ? 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    : 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  const calories = Math.round(bmr * FACTOR[activity_level ?? "light"]);
  // Macro split: protein 15%, carbs 55%, fat 30%, sugar max 10% of calories
  return {
    calories,
    protein: Math.round((calories * 0.15) / 4),
    carbs: Math.round((calories * 0.55) / 4),
    fat: Math.round((calories * 0.30) / 9),
    sugar: Math.round((calories * 0.10) / 4),
  };
};
