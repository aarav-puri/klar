export function KlarSymbol({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M15 7a11 11 0 0 0 0 22z" className="sym-l" />
      <path d="M17 3a11 11 0 0 1 0 22z" className="sym-r" />
    </svg>
  );
}
