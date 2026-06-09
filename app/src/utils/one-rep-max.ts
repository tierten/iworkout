import { PotentialSet } from '@/models/session-models';
import { Weight } from '@/models/weight';
import BigNumber from 'bignumber.js';

export type OneRepMaxFormula = 'epley' | 'brzycki';

export function epleyOneRepMax(weight: Weight, reps: number): Weight {
  return weight.multipliedBy(new BigNumber(1).plus(new BigNumber(reps).div(30)));
}

export function brzyckiOneRepMax(weight: Weight, reps: number): Weight {
  // Brzycki: 1RM = weight * 36 / (37 - reps)
  const denominator = new BigNumber(37).minus(reps);
  if (denominator.isLessThanOrEqualTo(0)) return weight;
  return weight.multipliedBy(new BigNumber(36).div(denominator));
}

export function calculateOneRepMax(
  weight: Weight,
  reps: number,
  formula: OneRepMaxFormula,
): Weight {
  return formula === 'brzycki'
    ? brzyckiOneRepMax(weight, reps)
    : epleyOneRepMax(weight, reps);
}

export function bestOneRepMax(
  sets: PotentialSet[],
  formula: OneRepMaxFormula,
): Weight | undefined {
  const candidates = sets
    .filter((ps) => ps.set && ps.set.repsCompleted > 0)
    .map((ps) => calculateOneRepMax(ps.weight, ps.set!.repsCompleted, formula));
  if (!candidates.length) return undefined;
  return candidates.reduce((best, w) => (w.isGreaterThan(best) ? w : best));
}
