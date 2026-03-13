import type { DerivedTheme, InspirationTarget } from '../domain/types';

type Props = {
  derived: DerivedTheme;
  dominant?: InspirationTarget;
};

const fontStack = (mode: DerivedTheme['discrete']['fontFamily']) => {
  if (mode === 'serif') return '"Iowan Old Style", "Palatino Linotype", Georgia, serif';
  if (mode === 'mono') return '"JetBrains Mono", "SFMono-Regular", "IBM Plex Mono", monospace';
  return '"IBM Plex Sans", "Avenir Next", "Helvetica Neue", sans-serif';
};

const formatCase = (copy: string, heroCase: DerivedTheme['discrete']['heroCase']) => {
  if (heroCase === 'upper') return copy.toUpperCase();
  if (heroCase === 'title') return copy.replace(/\b\w/g, (char) => char.toUpperCase());
  return copy;
};

export function PreviewSurface(props: Props) {
  const t = props.derived.tokens;
  return (
    <section className="preview-shell panel">
      <div className="panel-head">
        <div>
          <h2>Specimen</h2>
          <p>Fixed content tree. Variable system output.</p>
        </div>
        <div className="preview-stats">
          <span>{props.derived.weights.length} anchors</span>
          <span>{props.derived.contrast.toFixed(1)}:1 contrast</span>
        </div>
      </div>

      <div
        className="specimen"
        data-testid="preview-surface"
        style={{
          ['--spec-background' as string]: t.background,
          ['--spec-surface' as string]: t.surface,
          ['--spec-surface-2' as string]: t.surface2,
          ['--spec-text' as string]: t.text,
          ['--spec-muted' as string]: t.muted,
          ['--spec-border' as string]: t.border,
          ['--spec-accent' as string]: t.accent,
          ['--spec-accent-2' as string]: t.accent2,
          ['--spec-gradient-a' as string]: t.heroGradientA,
          ['--spec-gradient-b' as string]: t.heroGradientB,
          ['--spec-radius' as string]: `${t.radius}px`,
          ['--spec-font' as string]: fontStack(props.derived.discrete.fontFamily),
          ['--spec-title-size' as string]: `${t.titleSize}px`,
          ['--spec-body-size' as string]: `${t.bodySize}px`,
        }}
      >
        <header className="specimen-nav">
          <strong>Chimera Explorer</strong>
          <nav>
            <a href="/">Field</a>
            <a href="/">Tokens</a>
            <a href="/">Saved</a>
          </nav>
          <button type="button">Export</button>
        </header>

        <section className="specimen-hero">
          <div>
            <p>{props.dominant?.name ?? 'Derived blend'}</p>
            <h3>{formatCase('Local style neighborhood', props.derived.discrete.heroCase)}</h3>
            <span>One fixed product skeleton, continuously restyled by the current neighborhood and probe position.</span>
            <div className="specimen-actions">
              <button type="button">Export tokens</button>
              <button type="button" className="secondary">Save specimen</button>
            </div>
          </div>
          <div className="specimen-metrics">
            {props.derived.weights.slice(0, 4).map((item) => (
              <div key={item.id}>
                <small>{item.name}</small>
                <strong>{Math.round(item.weight * 100)}%</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="specimen-grid">
          <article className="specimen-feature">
            <h4>Composition rule</h4>
            <p>Any active neighborhood can shape the blend. Pins, active-set size, and per-token weighting keep the output inspectable instead of muddy.</p>
            <div className="mini-card-row">
              <div><small>Projection</small><strong>Multi-anchor</strong></div>
              <div><small>Kernel</small><strong>Distance-weighted</strong></div>
              <div><small>Replay</small><strong>Deterministic</strong></div>
            </div>
          </article>

          <article className="specimen-stack">
            <div className="mini-card">
              <small>Primary</small>
              <strong>Export current system</strong>
            </div>
            <div className="mini-card">
              <small>Secondary</small>
              <strong>Inspect anchor influence</strong>
            </div>
          </article>

          <article className="specimen-form">
            <h4>Form behavior</h4>
            <label>
              Project name
              <input type="text" value="Chimera research board" readOnly />
            </label>
            <label>
              Notes
              <textarea value="Field density, border pressure, muted copy, and reading rhythm should all stay coherent while the style neighborhood changes." readOnly />
            </label>
          </article>

          <aside className="specimen-side">
            <div className="mini-card">
              <small>Dominant anchor</small>
              <strong>{props.dominant?.name ?? 'Unknown'}</strong>
            </div>
            <div className="mini-card">
              <small>Button mode</small>
              <strong>{props.derived.discrete.buttonStyle}</strong>
            </div>
            <div className="mini-card">
              <small>Density mode</small>
              <strong>{props.derived.discrete.density}</strong>
            </div>
          </aside>

          <article className="specimen-feature specimen-weight-table">
            <h4>Influence table</h4>
            <div className="weight-table">
              {props.derived.weights.slice(0, 6).map((item) => (
                <div key={item.id} className="weight-row">
                  <span>{item.name}</span>
                  <div className="weight-bar"><i style={{ width: `${item.weight * 100}%` }} /></div>
                  <strong>{Math.round(item.weight * 100)}%</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </section>
  );
}
