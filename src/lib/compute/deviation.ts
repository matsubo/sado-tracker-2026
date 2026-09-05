const MIN_POPULATION = 5;

/**
 * Deviation score (偏差値) with faster times scoring higher, so 60 means one
 * standard deviation quicker than the field. Hidden when the sample is too
 * small to mean anything or when every recorded time is identical.
 */
export function deviationScore(values: readonly number[], own: number): number | null {
  if (values.length < MIN_POPULATION) return null;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return null;

  return 50 + (10 * (mean - own)) / sd;
}
