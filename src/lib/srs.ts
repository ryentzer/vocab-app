/**
 * Simplified SM-2 Spaced Repetition Algorithm
 * quality: 0 = missed, 2 = hard, 3 = good, 5 = easy
 */
export interface SRSResult {
  interval_days: number;
  ease_factor: number;
  next_review: string; // ISO date string YYYY-MM-DD
  mastery: number;
}

export function computeSRS(
  quality: 0 | 2 | 3 | 5,
  currentInterval: number,
  currentEase: number,
  currentMastery: number,
): SRSResult {
  let newInterval: number;
  let newEase: number;
  let newMastery: number;

  if (quality < 3) {
    // Missed or hard — reset to 1 day
    newInterval = 1;
    newEase = currentEase;
    newMastery = Math.max(0, currentMastery - 1);
  } else {
    // Good or easy — advance
    newInterval = Math.max(1, Math.round(currentInterval * currentEase));
    newEase = Math.max(1.3, currentEase + 0.1 - (5 - quality) * 0.08);
    newMastery = Math.min(5, currentMastery + 1);
  }

  const today = new Date();
  today.setDate(today.getDate() + newInterval);
  const nextReview = today.toISOString().split('T')[0]!;

  return {
    interval_days: newInterval,
    ease_factor: newEase,
    next_review: nextReview,
    mastery: newMastery,
  };
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}

export function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0]!;
}
