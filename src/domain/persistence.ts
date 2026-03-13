import { Effect, Layer, ManagedRuntime, Ref, Schema, ServiceMap } from 'effect';
import type { SavedBlendState } from './types';

const BlendPointSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
});

const ThemeTokensSchema = Schema.Struct({
  background: Schema.String,
  surface: Schema.String,
  surface2: Schema.String,
  text: Schema.String,
  muted: Schema.String,
  border: Schema.String,
  accent: Schema.String,
  accent2: Schema.String,
  heroGradientA: Schema.String,
  heroGradientB: Schema.String,
  heroSize: Schema.Number,
  titleSize: Schema.Number,
  bodySize: Schema.Number,
  heroWeight: Schema.Number,
  titleWeight: Schema.Number,
  bodyWeight: Schema.Number,
  tracking: Schema.Number,
  radius: Schema.Number,
  borderWidth: Schema.Number,
  shadowY: Schema.Number,
  shadowBlur: Schema.Number,
  shadowAlpha: Schema.Number,
  pageWidth: Schema.Number,
  gap: Schema.Number,
  pad: Schema.Number,
  cardPad: Schema.Number,
  lineHeight: Schema.Number,
});

const SavedBlendStateSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  seed: Schema.String,
  activeIds: Schema.Array(Schema.String),
  point: BlendPointSchema,
  savedAt: Schema.String,
  derived: ThemeTokensSchema,
});

const SavedBlendStatesSchema = Schema.Array(SavedBlendStateSchema);

export const ExplorerConfig = ServiceMap.Reference('ExplorerConfig', {
  defaultValue: () => ({
    storageKey: 'chimera:voidzero:saved-states',
    maxSavedStates: 24,
    defaultActiveCount: 6,
  }),
});

class BrowserStorage extends ServiceMap.Service<BrowserStorage, {
  readonly getItem: (key: string) => Effect.Effect<string | null>;
  readonly setItem: (key: string, value: string) => Effect.Effect<void>;
}>()('BrowserStorage') {
  static readonly layer = Layer.succeed(this)({
    getItem: Effect.fn('BrowserStorage.getItem')((key) => Effect.sync(() => window.localStorage.getItem(key))),
    setItem: Effect.fn('BrowserStorage.setItem')((key, value) => Effect.sync(() => window.localStorage.setItem(key, value))),
  });
}

export class SavedBlendStore extends ServiceMap.Service<SavedBlendStore, {
  readonly all: Effect.Effect<SavedBlendState[]>;
  readonly save: (entry: SavedBlendState) => Effect.Effect<SavedBlendState[]>;
  readonly remove: (id: string) => Effect.Effect<SavedBlendState[]>;
}>()('SavedBlendStore', {
  make: Effect.gen(function* () {
    const config = yield* ExplorerConfig;
    const storage = yield* BrowserStorage;
    const raw = yield* storage.getItem(config.storageKey);
    const decoded = raw
      ? yield* Effect.try({
        try: () => Schema.decodeUnknownSync(SavedBlendStatesSchema)(JSON.parse(raw)),
        catch: () => [] as SavedBlendState[],
      })
      : [];
    const ref = yield* Ref.make(decoded);

    const persist = Effect.fn('SavedBlendStore.persist')(function* (next: SavedBlendState[]) {
      yield* storage.setItem(config.storageKey, JSON.stringify(next));
      return next;
    });

    return {
      all: Ref.get(ref),
      save: Effect.fn('SavedBlendStore.save')(function* (entry: SavedBlendState) {
        yield* Ref.update(ref, (items) => [entry, ...items.filter((item) => item.id !== entry.id)].slice(0, config.maxSavedStates));
        const next = yield* Ref.get(ref);
        return yield* persist(next);
      }),
      remove: Effect.fn('SavedBlendStore.remove')(function* (id: string) {
        yield* Ref.update(ref, (items) => items.filter((item) => item.id !== id));
        const next = yield* Ref.get(ref);
        return yield* persist(next);
      }),
    };
  }),
}) {}

export const appLayer = Layer.mergeAll(
  BrowserStorage.layer,
  SavedBlendStore.layer,
);

export const appRuntime = ManagedRuntime.make(appLayer);
