import type { InspirationTarget } from '../domain/types';

type Props = {
  targets: InspirationTarget[];
  pinnedIds: string[];
  selectedTargetId: string | null;
  onSelect: (targetId: string) => void;
  onTogglePin: (targetId: string) => void;
  onReroll: (targetId: string) => void;
};

export function TargetStack(props: Props) {
  return (
    <section className="panel target-stack">
      <div className="panel-head">
        <div>
          <h2>Active neighborhood</h2>
          <p>Pin to preserve. Select to replace from the library.</p>
        </div>
      </div>
      <div className="target-table" data-testid="active-targets">
        {props.targets.map((target, index) => (
          <article
            key={target.id}
            className={`target-row${props.selectedTargetId === target.id ? ' is-selected' : ''}`}
            style={{ borderColor: target.tokens.border }}
            data-testid={`active-target-${index + 1}`}
          >
            <button type="button" className="target-card-main" onClick={() => props.onSelect(target.id)}>
              <span className="target-swatches">
                <span style={{ background: target.swatches[0] }} />
                <span style={{ background: target.swatches[1] }} />
              </span>
              <span className="target-copy">
                <strong>{target.name}</strong>
                <small>{target.blurb}</small>
              </span>
            </button>
            <div className="target-meta">
              <span>{target.discrete.fontFamily}</span>
              <span>{target.discrete.density}</span>
            </div>
            <div className="target-actions">
              <button type="button" onClick={() => props.onTogglePin(target.id)}>
                {props.pinnedIds.includes(target.id) ? 'Unpin' : 'Pin'}
              </button>
              <button type="button" onClick={() => props.onReroll(target.id)}>Reroll</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
