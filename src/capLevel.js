// Threshold ladder for the spending-cap notifications: 50, 75, 100, 110, 120, ...
// The level for a percentage is the highest step <= the percentage; below 50 there is none.
export function levelFor(percent) {
  // Rounded to absorb float error (e.g. 2900 * 100 / 1000 may not be exactly 290).
  const p = Math.round(percent * 1e6) / 1e6;
  if (!(p >= 50)) return null;
  if (p < 75) return 50;
  if (p < 100) return 75;
  return 100 + Math.floor((p - 100) / 10) * 10;
}
