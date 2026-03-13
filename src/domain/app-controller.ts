import { Effect } from 'effect';
import { appRuntime, ExplorerConfig, SavedBlendStore } from './persistence';
import { makeSeed, rerollTarget, selectActiveTargets } from './randomization';
import type { AppState, BlendPoint, SavedBlendState } from './types';

const initialPoint: BlendPoint = { x: 0.52, y: 0.44 };

export const buildInitialState = (input: {
  seed: string;
  activeIds: string[];
  savedStates: SavedBlendState[];
  defaultActiveCount: number;
}): AppState => ({
  seed: input.seed,
  activeIds: input.activeIds,
  pinnedIds: [],
  point: initialPoint,
  controls: {
    contrastGuard: true,
    blendSharpness: 1.45,
    snapStrength: 0.15,
    activeCount: input.defaultActiveCount,
  },
  selectedTargetId: input.activeIds[0] ?? null,
  savedStates: input.savedStates,
  status: 'Select a neighborhood, drag through it, then pin or save anything worth keeping.',
});

export const loadInitialState = (libraryIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const config = yield* ExplorerConfig;
    const seed = yield* makeSeed();
    const activeIds = yield* selectActiveTargets({
      seed,
      libraryIds,
      pinnedIds: [],
      currentIds: [],
      count: config.defaultActiveCount,
    });
    const store = yield* SavedBlendStore;
    const savedStates = yield* store.all;

    return buildInitialState({
      seed,
      activeIds,
      savedStates,
      defaultActiveCount: config.defaultActiveCount,
    });
  });

export const randomizeActiveSet = (input: {
  state: AppState;
  libraryIds: ReadonlyArray<string>;
}) =>
  selectActiveTargets({
    seed: input.state.seed,
    libraryIds: input.libraryIds,
    pinnedIds: input.state.pinnedIds,
    currentIds: input.state.activeIds,
    count: input.state.controls.activeCount,
  }).pipe(
    Effect.map((activeIds) => ({
      ...input.state,
      activeIds,
      selectedTargetId: activeIds[0] ?? null,
      status: 'Neighborhood regenerated from the current seed.',
    })),
  );

export const reshuffleActiveSet = (input: {
  state: AppState;
  libraryIds: ReadonlyArray<string>;
}) =>
  Effect.gen(function* () {
    const seed = yield* makeSeed();
    const activeIds = yield* selectActiveTargets({
      seed,
      libraryIds: input.libraryIds,
      pinnedIds: input.state.pinnedIds,
      currentIds: input.state.activeIds,
      count: input.state.controls.activeCount,
    });

    return {
      ...input.state,
      seed,
      activeIds,
      selectedTargetId: activeIds[0] ?? null,
      status: 'Seed changed. New neighborhood projected.',
    };
  });

export const rerollOneTarget = (input: {
  state: AppState;
  libraryIds: ReadonlyArray<string>;
  targetId: string;
}) =>
  rerollTarget({
    seed: input.state.seed,
    libraryIds: input.libraryIds,
    activeIds: input.state.activeIds,
    targetId: input.targetId,
  }).pipe(
    Effect.map((nextId) => ({
      ...input.state,
      activeIds: input.state.activeIds.map((id) => (id === input.targetId ? nextId : id)),
      selectedTargetId: nextId,
      status: 'Target rerolled inside the current neighborhood.',
    })),
  );

export const assignTarget = (input: {
  state: AppState;
  themeId: string;
}) =>
  Effect.sync(() => {
    if (!input.state.selectedTargetId) {
      const next = [...input.state.activeIds];
      if (!next.includes(input.themeId)) {
        next.push(input.themeId);
      }
      return {
        ...input.state,
        activeIds: next.slice(0, input.state.controls.activeCount),
        selectedTargetId: input.themeId,
        status: 'Theme added to the active neighborhood.',
      };
    }

    const nextIds = input.state.activeIds.map((id) => (id === input.state.selectedTargetId ? input.themeId : id));
    const unique = [...new Set(nextIds)];

    return {
      ...input.state,
      activeIds: unique,
      selectedTargetId: input.themeId,
      status: 'Selected anchor replaced from the library.',
    };
  });

export const saveBlendState = (input: {
  state: AppState;
  entry: SavedBlendState;
}) =>
  Effect.gen(function* () {
    const store = yield* SavedBlendStore;
    const savedStates = yield* store.save(input.entry);

    return {
      ...input.state,
      savedStates,
      status: `"${input.entry.label}" saved.`,
    };
  });

export const removeSavedBlendState = (input: {
  state: AppState;
  id: string;
}) =>
  Effect.gen(function* () {
    const store = yield* SavedBlendStore;
    const savedStates = yield* store.remove(input.id);
    return {
      ...input.state,
      savedStates,
      status: 'Saved state removed.',
    };
  });

export const runSync = <A>(effect: Effect.Effect<A, never, SavedBlendStore | typeof ExplorerConfig>) =>
  appRuntime.runSync(effect as never) as A;
