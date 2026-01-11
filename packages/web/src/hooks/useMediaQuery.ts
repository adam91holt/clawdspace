import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const handler = () => setMatches(media.matches);

    handler();

    // Modern browsers
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handler);
      return () => media.removeEventListener('change', handler);
    }

    // Safari fallback
    const legacy = media as unknown as {
      addListener: (cb: () => void) => void;
      removeListener: (cb: () => void) => void;
    };

    legacy.addListener(handler);
    return () => legacy.removeListener(handler);
  }, [query]);

  return matches;
}
