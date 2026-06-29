// Schofield W BMR + activity factors + macro distribution
// Defaults match: Tabel Schofield (Kkal/hari) = coef_w*BB + coef_h*TB + constant
// These defaults can be overridden at runtime via loadBmrConfig() which reads
// from the bmr_formulas / activity_factors tables (admin-editable).
import { supabase } from "@/integrations/supabase/client";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export interface BmrFormula {
  gender: "L" | "P";
  age_min: number;
  age_max: number;
  coef_weight: number;
  coef_height: number;
  constant: number;
  label?: string;
}

export const DEFAULT_FORMULAS: BmrFormula[] = [
  { gender: "L", age_min: 0,  age_max: 2,  coef_weight: 0.167, coef_height: 15.174, constant: -617.6, label: "Laki-laki 0-3 thn" },
  { gender: "L", age_min: 3,  age_max: 9,  coef_weight: 19.59, coef_height: 1.303,  constant: 414.9,  label: "Laki-laki 3-10 thn" },
  { gender: "L", age_min: 10, age_max: 18, coef_weight: 16.25, coef_height: 1.372,  constant: 515.5,  label: "Laki-laki 10-18 thn" },
  { gender: "P", age_min: 0,  age_max: 2,  coef_weight: 16.252, coef_height: 10.232, constant: -413.5, label: "Perempuan 0-3 thn" },
  { gender: "P", age_min: 3,  age_max: 9,  coef_weight: 16.969, coef_height: 1.618,  constant: 371.2,  label: "Perempuan 3-10 thn" },
  { gender: "P", age_min: 10, age_max: 18, coef_weight: 8.365,  coef_height: 4.65,   constant: 200,    label: "Perempuan 10-18 thn" },
];

export const DEFAULT_ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Sangat ringan (jarang olahraga)",
  light: "Ringan (1-3x/minggu)",
  moderate: "Sedang (3-5x/minggu)",
  active: "Sangat aktif (6-7x/minggu)",
  very_active: "Aktivitas berat (atlet)",
};

// Module-level dynamic config (hydrated from DB)
let FORMULAS: BmrFormula[] = DEFAULT_FORMULAS;
let FACTORS: Record<string, number> = { ...DEFAULT_ACTIVITY };
let SCHOOL_SHARE = 0.65;

export const loadBmrConfig = async () => {
  try {
    const [{ data: fs }, { data: af }, { data: ss }] = await Promise.all([
      supabase.from("bmr_formulas" as any).select("gender,age_min,age_max,coef_weight,coef_height,constant,label"),
      supabase.from("activity_factors" as any).select("key,factor"),
      supabase.from("school_settings" as any).select("school_share_pct").eq("id", 1).maybeSingle(),
    ]);
    if (fs && fs.length) FORMULAS = fs as any;
    if (af && af.length) {
      FACTORS = {};
      for (const r of af as any[]) FACTORS[r.key] = Number(r.factor);
    }
    if (ss && (ss as any).school_share_pct) SCHOOL_SHARE = Number((ss as any).school_share_pct);
  } catch { /* keep defaults */ }
};

export const getSchoolShare = () => SCHOOL_SHARE;
export const setSchoolShare = (v: number) => { SCHOOL_SHARE = v; };

export const getMbgCaloriesToday = async (): Promise<number> => {
  try {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const { data } = await supabase.from("mbg_entries" as any).select("calories").eq("entry_date", dateStr);
    return (data ?? []).reduce((s: number, r: any) => s + Number(r.calories || 0), 0);
  } catch { return 0; }
};

export const ageFromBirthdate = (birthDate: string | null | undefined): number => {
  if (!birthDate) return 12;
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return Math.max(0, age);
};

export const pickFormula = (gender: "L" | "P", age: number, formulas: BmrFormula[] = FORMULAS): BmrFormula | null => {
  const same = formulas.filter((f) => f.gender === gender);
  const hit = same.find((f) => age >= f.age_min && age <= f.age_max);
  if (hit) return hit;
  // fallback: closest by age_max
  return same.sort((a, b) => b.age_max - a.age_max)[0] ?? null;
};

export const calcBMR = (p: { gender: "L" | "P"; age: number; height_cm: number; weight_kg: number }, formulas: BmrFormula[] = FORMULAS) => {
  const f = pickFormula(p.gender, p.age, formulas);
  if (!f) return 0;
  return f.coef_weight * p.weight_kg + f.coef_height * p.height_cm + f.constant;
};

export interface DailyTarget {
  calories: number; protein: number; carbs: number; fat: number; sugar: number;
}

const scaleTarget = (full: DailyTarget): DailyTarget => {
  const calories = Math.round(full.calories * SCHOOL_SHARE);
  return {
    calories,
    protein: Math.round((calories * 0.15) / 4),
    carbs: Math.round((calories * 0.55) / 4),
    fat: Math.round((calories * 0.30) / 9),
    sugar: Math.round((calories * 0.10) / 4),
  };
};

export const calcDailyTarget = (
  p: {
    gender?: "L" | "P" | null;
    birth_date?: string | null;
    height_cm?: number | null;
    weight_kg?: number | null;
    activity_level?: ActivityLevel | null;
  },
  fallback: DailyTarget = { calories: 2000, protein: 50, carbs: 275, fat: 65, sugar: 50 },
): DailyTarget => {
  const { gender, birth_date, height_cm, weight_kg, activity_level } = p;
  if (!height_cm || !weight_kg || !birth_date) return scaleTarget(fallback);
  const age = ageFromBirthdate(birth_date);
  const bmr = calcBMR({ gender: (gender ?? "L") as "L" | "P", age, height_cm, weight_kg });
  if (!bmr || bmr <= 0) return scaleTarget(fallback);
  const factor = FACTORS[activity_level ?? "light"] ?? 1.375;
  const fullCalories = Math.round(bmr * factor);
  return scaleTarget({ calories: fullCalories, protein: 0, carbs: 0, fat: 0, sugar: 0 });
};

// Returns the full (24h) daily target without school share applied
export const calcFullDailyTarget = (
  p: Parameters<typeof calcDailyTarget>[0],
  fallback: DailyTarget = { calories: 2000, protein: 50, carbs: 275, fat: 65, sugar: 50 },
): DailyTarget => {
  const { gender, birth_date, height_cm, weight_kg, activity_level } = p;
  if (!height_cm || !weight_kg || !birth_date) return fallback;
  const age = ageFromBirthdate(birth_date);
  const bmr = calcBMR({ gender: (gender ?? "L") as "L" | "P", age, height_cm, weight_kg });
  if (!bmr || bmr <= 0) return fallback;
  const factor = FACTORS[activity_level ?? "light"] ?? 1.375;
  const calories = Math.round(bmr * factor);
  return {
    calories,
    protein: Math.round((calories * 0.15) / 4),
    carbs: Math.round((calories * 0.55) / 4),
    fat: Math.round((calories * 0.30) / 9),
    sugar: Math.round((calories * 0.10) / 4),
  };
};

export const getActivityFactors = () => ({ ...FACTORS });
export const getFormulas = () => [...FORMULAS];
