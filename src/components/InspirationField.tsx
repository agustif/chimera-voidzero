import { useEffect, useRef } from 'react';
import type { BlendPoint, InspirationTarget } from '../domain/types';

type Props = {
  point: BlendPoint;
  targets: InspirationTarget[];
  weights: Array<{ id: string; name: string; weight: number }>;
  selectedTargetId: string | null;
  pinnedIds: string[];
  onPointChange: (point: BlendPoint) => void;
  onTargetSelect: (targetId: string) => void;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function InspirationField(props: Props) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!draggingRef.current || !fieldRef.current) return;
      const rect = fieldRef.current.getBoundingClientRect();
      props.onPointChange({
        x: clamp((event.clientX - rect.left) / rect.width),
        y: clamp((event.clientY - rect.top) / rect.height),
      });
    };

    const stop = () => {
      draggingRef.current = false;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);

    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
  }, [props]);

  return (
    <section className="panel field-panel">
      <div className="panel-head">
        <div>
          <h2>Inspiration field</h2>
          <p>Drag through the active neighborhood or use arrow keys for smaller moves.</p>
        </div>
        <div className="field-coords" data-testid="blend-coordinates">{props.point.x.toFixed(2)} × {props.point.y.toFixed(2)}</div>
      </div>

      <div
        ref={fieldRef}
        className="inspiration-field"
        role="slider"
        aria-label="Blend position"
        aria-valuetext={`${Math.round(props.point.x * 100)} by ${Math.round(props.point.y * 100)}`}
        tabIndex={0}
        data-testid="inspiration-field"
        onPointerDown={(event) => {
          draggingRef.current = true;
          const rect = event.currentTarget.getBoundingClientRect();
          props.onPointChange({
            x: clamp((event.clientX - rect.left) / rect.width),
            y: clamp((event.clientY - rect.top) / rect.height),
          });
        }}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.05 : 0.025;
          if (event.key === 'ArrowLeft') props.onPointChange({ x: clamp(props.point.x - step), y: props.point.y });
          if (event.key === 'ArrowRight') props.onPointChange({ x: clamp(props.point.x + step), y: props.point.y });
          if (event.key === 'ArrowUp') props.onPointChange({ x: props.point.x, y: clamp(props.point.y - step) });
          if (event.key === 'ArrowDown') props.onPointChange({ x: props.point.x, y: clamp(props.point.y + step) });
        }}
      >
        {props.targets.map((target) => {
          const weight = props.weights.find((item) => item.id === target.id)?.weight ?? 0;
          return (
            <button
              key={target.id}
              type="button"
              className={`field-node${props.selectedTargetId === target.id ? ' is-selected' : ''}`}
              style={{ left: `${target.position.x * 100}%`, top: `${target.position.y * 100}%`, borderColor: target.tokens.border, background: target.tokens.surface }}
              onClick={() => props.onTargetSelect(target.id)}
              data-testid={`field-node-${target.id}`}
            >
              <span className="field-node-dot" style={{ background: target.tokens.accent }} />
              <span className="field-node-label">
                <strong>{target.name}</strong>
                <small>{Math.round(weight * 100)}%</small>
                {props.pinnedIds.includes(target.id) ? <em>Pinned</em> : null}
              </span>
            </button>
          );
        })}

        <div
          className="field-probe"
          style={{ left: `${props.point.x * 100}%`, top: `${props.point.y * 100}%` }}
          data-testid="field-probe"
        />
      </div>
    </section>
  );
}
