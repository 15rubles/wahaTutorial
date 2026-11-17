/** Small inline icons for section bars (our own simple shapes). */
export function CrosshairIcon() {
  return (
    <svg className="bar-icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M10 1v5M10 14v5M1 10h5M14 10h5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function BladesIcon() {
  return (
    <svg className="bar-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 3l11 11M17 3L6 14" stroke="currentColor" strokeWidth="2.4" />
      <path d="M12 16l4-4 2 2-4 4zM8 16l-4-4-2 2 4 4z" fill="currentColor" />
    </svg>
  );
}
