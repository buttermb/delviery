/**
 * BreadcrumbContext
 * Allows detail pages to provide entity-specific labels for breadcrumbs.
 * Example: OrderDetailsPage sets label "Order #12345" which replaces
 * the generic "Order Details" text in the breadcrumb trail.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

interface BreadcrumbContextValue {
  /** Current override label for the last breadcrumb segment */
  entityLabel: string | null;
  /** Set the label for the current detail page's breadcrumb */
  setEntityLabel: (label: string | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  entityLabel: null,
  setEntityLabel: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [entityLabel, setEntityLabelState] = useState<string | null>(null);

  const setEntityLabel = useCallback((label: string | null) => {
    setEntityLabelState(label);
  }, []);

  const value = useMemo(
    () => ({ entityLabel, setEntityLabel }),
    [entityLabel, setEntityLabel]
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/**
 * Hook for detail pages to set their entity label in the breadcrumb.
 * Automatically clears the label on unmount.
 *
 * Usage:
 *   useBreadcrumbLabel(order ? `Order #${order.order_number}` : null);
 */
export function useBreadcrumbLabel(label: string | null | undefined) {
  const { setEntityLabel } = useContext(BreadcrumbContext);

  useEffect(() => {
    setEntityLabel(label ?? null);
    return () => setEntityLabel(null);
  }, [label, setEntityLabel]);
}

export function useBreadcrumbContext() {
  return useContext(BreadcrumbContext);
}
