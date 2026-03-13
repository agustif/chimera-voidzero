import type { DiscreteTheme, InspirationTarget } from './types';

const keys: (keyof DiscreteTheme)[] = ['fontFamily', 'heroCase', 'buttonStyle', 'density'];

export const voteDiscreteTheme = (
  weights: Map<string, number>,
  targets: InspirationTarget[],
  snapThreshold: number,
): DiscreteTheme => {
  const ordered = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  const winner = ordered[0];

  if (winner && winner[1] >= snapThreshold) {
    const target = targets.find((item) => item.id === winner[0]);
    if (target) {
      return target.discrete;
    }
  }

  return keys.reduce<DiscreteTheme>((acc, key) => {
    const totals = new Map<string, number>();

    for (const target of targets) {
      const weight = weights.get(target.id) ?? 0;
      const value = target.discrete[key];
      totals.set(value, (totals.get(value) ?? 0) + weight);
    }

    acc[key] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0][0] as DiscreteTheme[typeof key];
    return acc;
  }, {} as DiscreteTheme);
};
