import type { InspirationTarget } from '../domain/types';

type Props = {
  allTargets: InspirationTarget[];
  activeIds: string[];
  selectedTargetId: string | null;
  onAssign: (targetId: string) => void;
  onSelectReplacement: (targetId: string | null) => void;
};

export function LibraryDrawer(props: Props) {
  return (
    <section className="panel library-panel">
      <div className="panel-head">
        <div>
          <h2>Library</h2>
          <p>Global corpus. The current neighborhood is only a temporary projection.</p>
        </div>
        <button type="button" className="text-button" onClick={() => props.onSelectReplacement(null)}>
          {props.selectedTargetId ? 'Clear selected anchor' : 'No anchor selected'}
        </button>
      </div>
      <div className="library-list" data-testid="library-grid">
        {props.allTargets.map((target) => {
          const isActive = props.activeIds.includes(target.id);
          return (
            <article key={target.id} className={`library-row${isActive ? ' is-active' : ''}`}>
              <div className="target-swatches">
                <span style={{ background: target.swatches[0] }} />
                <span style={{ background: target.swatches[1] }} />
              </div>
              <div className="library-copy">
                <strong>{target.name}</strong>
                <small>{target.blurb}</small>
              </div>
              <div className="library-meta">
                <span>{target.discrete.fontFamily}</span>
                <span>{target.discrete.buttonStyle}</span>
              </div>
              <button type="button" onClick={() => props.onAssign(target.id)}>
                {props.selectedTargetId ? 'Assign to selected' : isActive ? 'Already active' : 'Add / assign'}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
