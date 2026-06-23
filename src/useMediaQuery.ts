// Хук для отслеживания media queries — для адаптивной логики
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

// Готовые брейкпоинты
export function useIsMobile() {
  return !useMediaQuery('(min-width: 768px)');
}
export function useIsTablet() {
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  return isTablet;
}
export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)');
}
export function useIsLargeScreen() {
  return useMediaQuery('(min-width: 1280px)');
}