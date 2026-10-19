/** Eight-point guiding star. The one bright thing in the interface. */
export function Star({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M12 1.5 13.6 9.2 19.4 4.6 14.8 10.4 22.5 12 14.8 13.6 19.4 19.4 13.6 14.8 12 22.5 10.4 14.8 4.6 19.4 9.2 13.6 1.5 12 9.2 10.4 4.6 4.6 10.4 9.2Z"
        fill="currentColor"
      />
    </svg>
  );
}
