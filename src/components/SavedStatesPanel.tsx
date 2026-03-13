import type { SavedBlendState } from '../domain/types';

type Props = {
  savedStates: SavedBlendState[];
  onLoad: (saved: SavedBlendState) => void;
  onRemove: (id: string) => void;
};

export function SavedStatesPanel(props: Props) {
  return (
    <section className="panel saved-panel">
      <div className="panel-head">
        <div>
          <h2>Saved blends</h2>
          <p>Seed, anchors, probe coordinate, derived tokens.</p>
        </div>
      </div>
      <div className="saved-list" data-testid="saved-states">
        {props.savedStates.length === 0 ? (
          <div className="empty-state">No saved blends yet. Save the first strong neighborhood you find.</div>
        ) : (
          props.savedStates.map((saved) => (
            <article key={saved.id} className="saved-item">
              <div>
                <strong>{saved.label}</strong>
                <small>{saved.seed} · {saved.activeIds.length} anchors · {new Date(saved.savedAt).toLocaleString()}</small>
              </div>
              <div className="saved-actions">
                <button type="button" onClick={() => props.onLoad(saved)}>Load</button>
                <button type="button" onClick={() => props.onRemove(saved.id)}>Remove</button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
