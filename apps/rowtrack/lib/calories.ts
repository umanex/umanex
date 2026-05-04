const DEFAULT_WEIGHT_KG = 75; // gemiddeld volwassene

export function calculateCalories(
  watts: number,
  durationSeconds: number,
  weightKg: number = DEFAULT_WEIGHT_KG,
): number {
  // VO2-gebaseerd (Concept2 / roeien specifiek)
  const vo2 = (watts * 14.4) / weightKg + 7;
  const met = vo2 / 3.5;
  return met * weightKg * (durationSeconds / 3600);
}

// Alias voor achterwaartse compatibiliteit
export const calculateCaloriesWithProfile = calculateCalories;
