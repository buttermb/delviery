import { useState, useEffect } from 'react';

/**
 * Admin-specific mobile detection hook.
 * Uses 1024px breakpoint (Tailwind `lg`) to match the admin layout's
 * mobile bottom nav (`lg:hidden`) and sidebar visibility (`lg:block`).
 *
 * The global `useIsMobile` (768px) is kept unchanged for storefront/customer contexts.
 */
const ADMIN_MOBILE_BREAKPOINT = 1024;

export function useIsAdminMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${ADMIN_MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < ADMIN_MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < ADMIN_MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
