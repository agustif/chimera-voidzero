import { useEffect, useMemo, useState } from 'react';
import { assignTarget, loadInitialState, randomizeActiveSet, removeSavedBlendState, rerollOneTarget, reshuffleActiveSet, runSync, saveBlendState } from './domain/app-controller';
import { blendTheme } from './domain/interpolation';
import { themeLibrary, themeLibraryMap } from './domain/themeLibrary';
import type { AppState, SavedBlendState } from './domain/types';
import { InspirationField } from './components/InspirationField';
import { LibraryDrawer } from './components/LibraryDrawer';
import { PreviewSurface } from './components/PreviewSurface';
import { SavedStatesPanel } from './components/SavedStatesPanel';
import { TargetStack } from './components/TargetStack';

const libraryIds = themeLibrary.map((target) => target.id);

function fallbackState(): AppState {
  return {
    seed: 'fallback',
    activeIds: libraryIds.slice(0, 6),
    pinnedIds: [],
    point: { x: 0.52, y: 0.44 },
    controls: {
      contrastGuard: true,
      blendSharpness: 1.45,
      snapStrength: 0.15,
      activeCount: 6,
    },
    selectedTargetId: libraryIds[0] ?? null,
    savedStates: [],
    status: 'Recovered from initialization failure. Ready for live debugging.',
  };
}

function createSavedState(state: AppState, derivedTokens: SavedBlendState['derived']): SavedBlendState {
  const timestamp = new Date();
  return {
    id: `${timestamp.getTime()}`,
    label: `Blend ${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    seed: state.seed,
    activeIds: state.activeIds,
    point: state.point,
    savedAt: timestamp.toISOString(),
    derived: derivedTokens,
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    try {
      return runSync(loadInitialState(libraryIds));
    } catch (error) {
      console.error('App initialization failed', error);
      return fallbackState();
    }
  });

  const activeTargets = useMemo(
    () => state.activeIds.map((id) => themeLibraryMap.get(id)).filter(Boolean),
    [state.activeIds],
  );

  const derived = useMemo(() => blendTheme({
    targets: activeTargets,
    point: state.point,
    blendSharpness: state.controls.blendSharpness,
    snapStrength: state.controls.snapStrength,
    contrastGuard: state.controls.contrastGuard,
  }), [activeTargets, state.controls.blendSharpness, state.controls.contrastGuard, state.controls.snapStrength, state.point]);

  const dominantTarget = themeLibraryMap.get(derived.dominantTargetId);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target && ['INPUT', 'TEXTAREA'].includes(target.tagName);
      if (isTyping) return;

      if (event.key.toLowerCase() === 'r' && event.shiftKey) {
        event.preventDefault();
        setState((current) => runSync(reshuffleActiveSet({ state: current, libraryIds })));
        return;
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        setState((current) => runSync(randomizeActiveSet({ state: current, libraryIds })));
        return;
      }

      const numeric = Number.parseInt(event.key, 10);
      if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= state.activeIds.length) {
        event.preventDefault();
        const targetId = state.activeIds[numeric - 1];
        setState((current) => runSync(rerollOneTarget({ state: current, libraryIds, targetId })));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.activeIds]);

  return (
    <div className="app-shell">
      <aside className="control-rail">
        <div className="rail-header">
          <h1>Chimera VoidZero</h1>
          <p>Project local style neighborhoods from a larger inspiration corpus, then keep only the anchors that still hold up under movement.</p>
        </div>

        <div className="panel control-panel">
          <div className="panel-head">
            <div>
              <h2>Neighborhood controls</h2>
              <p>Deterministic seed, variable anchor count, selective pinning.</p>
            </div>
          </div>

          <div className="control-group">
            <label>
              Current seed
              <input type="text" value={state.seed} readOnly data-testid="seed-display" />
            </label>
            <div className="inline-actions">
              <button type="button" onClick={() => setState((current) => runSync(randomizeActiveSet({ state: current, libraryIds })))} data-testid="randomize-button">Randomize neighborhood</button>
              <button type="button" onClick={() => setState((current) => runSync(reshuffleActiveSet({ state: current, libraryIds })))} data-testid="reshuffle-button">Reshuffle seed</button>
            </div>
          </div>

          <div className="control-group">
            <label>
              Active anchor count
              <input
                type="range"
                min={3}
                max={10}
                value={state.controls.activeCount}
                onChange={(event) => {
                  const nextCount = Number(event.target.value);
                  setState((current) => runSync(randomizeActiveSet({
                    state: {
                      ...current,
                      controls: {
                        ...current.controls,
                        activeCount: nextCount,
                      },
                    },
                    libraryIds,
                  })));
                }}
              />
            </label>
            <span>{state.controls.activeCount} active anchors</span>
          </div>

          <div className="control-group">
            <label>
              Blend sharpness
              <input
                type="range"
                min={1}
                max={2.4}
                step={0.05}
                value={state.controls.blendSharpness}
                onChange={(event) => setState((current) => ({
                  ...current,
                  controls: {
                    ...current.controls,
                    blendSharpness: Number(event.target.value),
                  },
                }))}
                data-testid="sharpness-slider"
              />
            </label>
            <span>{state.controls.blendSharpness.toFixed(2)}x</span>
          </div>

          <div className="control-group">
            <label>
              Snap toward nearest anchor
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={state.controls.snapStrength}
                onChange={(event) => setState((current) => ({
                  ...current,
                  controls: {
                    ...current.controls,
                    snapStrength: Number(event.target.value),
                  },
                }))}
              />
            </label>
            <span>{Math.round(state.controls.snapStrength * 100)}%</span>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={state.controls.contrastGuard}
              onChange={(event) => setState((current) => ({
                ...current,
                controls: {
                  ...current.controls,
                  contrastGuard: event.target.checked,
                },
              }))}
            />
            <span>Keep contrast guard enabled</span>
          </label>

          <button
            type="button"
            className="full-width"
            onClick={() => setState((current) => runSync(saveBlendState({
              state: current,
              entry: createSavedState(current, derived.tokens),
            })))}
            data-testid="save-blend-button"
          >
            Save current blend
          </button>

          <div className="status-text" data-testid="status-text">{state.status}</div>
        </div>

        <SavedStatesPanel
          savedStates={state.savedStates}
          onLoad={(saved) => setState((current) => ({
            ...current,
            seed: saved.seed,
            activeIds: saved.activeIds,
            point: saved.point,
            selectedTargetId: saved.activeIds[0] ?? null,
            status: `"${saved.label}" loaded.`,
          }))}
          onRemove={(id) => setState((current) => runSync(removeSavedBlendState({ state: current, id })))}
        />
      </aside>

      <main className="workspace">
        <InspirationField
          point={state.point}
          targets={activeTargets}
          weights={derived.weights}
          selectedTargetId={state.selectedTargetId}
          pinnedIds={state.pinnedIds}
          onPointChange={(point) => setState((current) => ({ ...current, point }))}
          onTargetSelect={(targetId) => setState((current) => ({ ...current, selectedTargetId: targetId }))}
        />

        <TargetStack
          targets={activeTargets}
          pinnedIds={state.pinnedIds}
          selectedTargetId={state.selectedTargetId}
          onSelect={(targetId) => setState((current) => ({ ...current, selectedTargetId: targetId }))}
          onTogglePin={(targetId) => setState((current) => ({
            ...current,
            pinnedIds: current.pinnedIds.includes(targetId)
              ? current.pinnedIds.filter((id) => id !== targetId)
              : [...current.pinnedIds, targetId],
          }))}
          onReroll={(targetId) => setState((current) => runSync(rerollOneTarget({ state: current, libraryIds, targetId })))}
        />

        <PreviewSurface derived={derived} dominant={dominantTarget} />

        <LibraryDrawer
          allTargets={themeLibrary}
          activeIds={state.activeIds}
          selectedTargetId={state.selectedTargetId}
          onAssign={(targetId) => setState((current) => runSync(assignTarget({ state: current, themeId: targetId })))}
          onSelectReplacement={(targetId) => setState((current) => ({ ...current, selectedTargetId: targetId }))}
        />
      </main>
    </div>
  );
}
