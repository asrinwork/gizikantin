import type { DailyTarget } from "./calorie";

export interface FoodMin {
  id: string; name: string;
  calories: number; protein: number; carbs: number; fat: number; sugar: number;
  price?: number;
}

export interface Consumed { calories: number; protein: number; carbs: number; fat: number; sugar: number; }

/** Rank foods that best fill the remaining calorie/macro gap. Excludes foods that would overshoot calories. */
export const recommend = (foods: FoodMin[], target: DailyTarget, consumed: Consumed, limit = 5): FoodMin[] => {
  const remain = {
    calories: Math.max(0, target.calories - consumed.calories),
    protein: Math.max(0, target.protein - consumed.protein),
    carbs: Math.max(0, target.carbs - consumed.carbs),
    fat: Math.max(0, target.fat - consumed.fat),
    sugar: Math.max(0, target.sugar - consumed.sugar),
  };
  if (remain.calories <= 0) return [];

  const scored = foods
    .filter((f) => f.calories > 0 && f.calories <= remain.calories)
    .map((f) => {
      // Calorie fit (lower delta is better)
      const calDelta = Math.abs(f.calories - remain.calories) / Math.max(1, remain.calories);
      // Macro fit: encourage filling deficit, penalize overshoot of sugar
      const macroScore =
        Math.min(1, f.protein / Math.max(1, remain.protein)) * 0.35 +
        Math.min(1, f.carbs / Math.max(1, remain.carbs)) * 0.25 +
        Math.min(1, f.fat / Math.max(1, remain.fat)) * 0.2;
      const sugarPenalty = remain.sugar > 0 ? Math.max(0, f.sugar - remain.sugar) / Math.max(1, target.sugar) : f.sugar / 50;
      const score = (1 - calDelta) * 0.6 + macroScore * 0.4 - sugarPenalty * 0.2;
      return { food: f, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.food);

  return scored;
};
