/** RheumaTrack mark: a joint centre with a partial range-of-motion arc. */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="36 54" transform="rotate(-90 12 12)" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <path d="M12 12 L18.5 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
