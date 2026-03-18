import { useEffect } from 'react';

/**
 * Sets document.title to "FloraIQ — {pageTitle}" on mount and when title changes.
 * Resets to default on unmount.
 */
export function usePageTitle(pageTitle: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `FloraIQ — ${pageTitle}`;
    return () => {
      document.title = previous;
    };
  }, [pageTitle]);
}
