import { Effect } from 'effect';

const hashSeed = (seed: string) => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (value: number) => () => {
  let next = (value += 0x6d2b79f5);
  next = Math.imul(next ^ (next >>> 15), next | 1);
  next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
  return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
};

export const seededShuffle = (ids: ReadonlyArray<string>, seed: string) => {
  const random = mulberry32(hashSeed(seed));
  const copy = [...ids];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

export const makeSeed = () =>
  Effect.sync(() => Math.random().toString(36).slice(2, 10));

export const selectActiveTargets = (input: {
  seed: string;
  libraryIds: ReadonlyArray<string>;
  pinnedIds: ReadonlyArray<string>;
  currentIds: ReadonlyArray<string>;
  count: number;
}) =>
  Effect.sync(() => {
    const uniquePins = [...new Set(input.pinnedIds)];
    const desiredCount = Math.max(uniquePins.length, Math.min(input.count, input.libraryIds.length));
    const pinnedSet = new Set(uniquePins);
    const shuffled = seededShuffle(input.libraryIds, input.seed).filter((id) => !pinnedSet.has(id));
    const next = [...uniquePins];

    for (const candidate of shuffled) {
      if (next.length >= desiredCount) break;
      next.push(candidate);
    }

    if (next.length < desiredCount) {
      for (const id of input.currentIds) {
        if (next.length >= desiredCount) break;
        if (!next.includes(id)) next.push(id);
      }
    }

    return next.slice(0, desiredCount);
  });

export const rerollTarget = (input: {
  seed: string;
  libraryIds: ReadonlyArray<string>;
  activeIds: ReadonlyArray<string>;
  targetId: string;
}) =>
  Effect.sync(() => {
    const blocked = new Set(input.activeIds.filter((id) => id !== input.targetId));
    return seededShuffle(input.libraryIds, `${input.seed}:${input.targetId}`)
      .find((id) => !blocked.has(id) && id !== input.targetId) ?? input.targetId;
  });
