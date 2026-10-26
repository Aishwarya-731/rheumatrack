/**
 * Ring gauge showing an observed ROM on a fixed 0–180° angle scale. The scale is the range of
 * possible angles, not a normative or "healthy" range, so no rating label is shown.
 */
export const ROM_RING_SCALE_DEG = 180;

export function RomRing({ romDeg, size = 132, color = 'var(--accent)', caption }: { romDeg: number | null; size?: number; color?: string; caption: string }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = romDeg === null ? 0 : Math.max(0, Math.min(1, romDeg / ROM_RING_SCALE_DEG));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {romDeg !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${fraction * c} ${c}`}
            style={{ transition: 'stroke-dasharray 500ms ease' }}
          />
        )}
      </svg>
      <div className="ring-label">
        <div>
          <div className="ring-value">{romDeg === null ? '—' : `${romDeg.toFixed(1)}°`}</div>
          <div className="ring-caption">{caption}</div>
        </div>
      </div>
    </div>
  );
}
