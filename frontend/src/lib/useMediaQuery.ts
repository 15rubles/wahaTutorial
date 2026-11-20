import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 1023px)';

/** True while the media query matches (false where matchMedia is unavailable). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
