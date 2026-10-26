import { useSelection } from '@/app/providers/SelectionProvider';
import { JOINTS, jointLabel, SIDES, type Joint, type Side } from '@/domain/joints';

/**
 * 2D front-view body diagram with 12 selectable joints. The figure faces the viewer, so the
 * person's RIGHT side is on the viewer's LEFT (as on a clinical body chart). Each joint is a
 * real button with an accessible name; the diagram is fully keyboard operable.
 */
const POS: Record<Joint, { x: number; y: number }> = {
  shoulder: { x: 38, y: 74 },
  elbow: { x: 46, y: 124 },
  wrist: { x: 52, y: 170 },
  hip: { x: 20, y: 172 },
  knee: { x: 21, y: 250 },
  ankle: { x: 20, y: 322 },
};
const CX = 100;

export function jointPoint(joint: Joint, side: Side): { x: number; y: number } {
  const p = POS[joint];
  // Viewer's left = person's right.
  return { x: side === 'right' ? CX - p.x : CX + p.x, y: p.y };
}

export function BodyDiagram({ onSelect }: { onSelect?: (j: Joint, s: Side) => void }) {
  const { joint, side, select } = useSelection();
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
      <svg viewBox="0 0 200 350" width="100%" style={{ maxWidth: 220 }} role="group" aria-label="Body diagram — select a joint">
        <g fill="var(--surface-3)" stroke="var(--border-strong)" strokeWidth="1.2">
          <ellipse cx="100" cy="26" rx="17" ry="21" />
          <rect x="93" y="44" width="14" height="14" rx="5" />
          <path d="M66 64 Q100 56 134 64 L131 150 Q100 160 69 150 Z" />
          <path d="M70 150 Q100 166 130 150 L128 182 Q100 190 72 182 Z" />
          <path d="M66 66 L56 70 L49 126 L44 170 L50 172 L58 128 L66 92 Z" />
          <path d="M134 66 L144 70 L151 126 L156 170 L150 172 L142 128 L134 92 Z" />
          <path d="M74 180 L72 252 L76 322 L88 322 L90 252 L98 186 Z" />
          <path d="M126 180 L128 252 L124 322 L112 322 L110 252 L102 186 Z" />
        </g>
        <text x="16" y="342" fontSize="10" fill="var(--text-subtle)">
          Right
        </text>
        <text x="184" y="342" fontSize="10" fill="var(--text-subtle)" textAnchor="end">
          Left
        </text>
        {JOINTS.flatMap((j) =>
          SIDES.map((s) => {
            const { x, y } = jointPoint(j, s);
            const active = j === joint && s === side;
            const label = jointLabel(j, s);
            return (
              <g
                key={`${j}-${s}`}
                role="button"
                tabIndex={0}
                aria-label={`Select ${label}`}
                aria-pressed={active}
                data-testid={`diagram-${j}-${s}`}
                style={{ cursor: 'pointer', outline: 'none' }}
                onClick={() => {
                  select(j, s);
                  onSelect?.(j, s);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select(j, s);
                    onSelect?.(j, s);
                  }
                }}
                className="diagram-joint"
              >
                <title>{label}</title>
                <circle cx={x} cy={y} r={14} fill="transparent" />
                {active && <circle cx={x} cy={y} r={11} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />}
                <circle cx={x} cy={y} r={active ? 6.5 : 5.5} fill={active ? 'var(--accent)' : 'var(--text-subtle)'} stroke="var(--surface)" strokeWidth="2" />
              </g>
            );
          }),
        )}
      </svg>
      <span className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>
        Front view — your right side is on the left
      </span>
    </div>
  );
}
