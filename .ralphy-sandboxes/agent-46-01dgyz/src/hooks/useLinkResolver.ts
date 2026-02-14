/**
 * Cross-Module Link Resolver Hook
 *
 * Given an entity reference (type + id), resolves to a display card with
 * name, status, and link. Caches resolutions via TanStack Query.
 * Supports batch resolution for multiple references efficiently.
 * Falls back gracefully for deleted entities.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';

import type { EntityType } from '@/lib/constants/entityTypes';
import { ENTITY_LABELS, getEntityRoute } from '@/lib/constants/entityTypes';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedEntity {
  /** The entity type that was resolved */
  entityType: EntityType;
  /** The entity's unique ID */
  entityId: string;
  /** Human-readable display name */
  name: string;
  /** Current status (e.g. "active", "completed", "pending") */
  status: string | null;
  /** Full admin URL for linking, null if no tenant context */
  url: string | null;
  /** True if the entity was not found (deleted or missing) */
  deleted: boolean;
}

export interface UseLinkResolverReturn {
  /** The resolved entity data */
  resolved: ResolvedEntity | null;
  /** Whether the resolution is in progress */
  isLoading: boolean;
  /** Whether the resolution failed */
  isError: boolean;
}

export interface UseBatchLinkResolverReturn {
  /** Map of "entityType:entityId" → resolved entity */
  resolvedMap: Map<string, ResolvedEntity>;
  /** Whether any resolutions are in progress */
  isLoading: boolean;
  /** Whether any resolutions failed */
  isError: boolean;
  /** Get a resolved entity by type and id */
  getResolved: (entityType: EntityType, entityId: string) => ResolvedEntity | null;
}

export interface EntityReference {
  entityType: EntityType;
  entityId: string;
}

// ---------------------------------------------------------------------------
// Column mappings per entity type
// ---------------------------------------------------------------------------

interface EntityColumns {
  table: string;
  nameColumn: string;
  statusColumn: string | null;
  /** Additional identifier column (e.g. order_number) used as name fallback */
  numberColumn?: string;
}

const ENTITY_COLUMN_MAP: Record<EntityType, EntityColumns> = {
  ORDER: {
    table: 'orders',
    nameColumn: 'customer_name',
    statusColumn: 'status',
    numberColumn: 'order_number',
  },
  PRODUCT: {
    table: 'products',
    nameColumn: 'name',
    statusColumn: 'status',
  },
  CUSTOMER: {
    table: 'customers',
    nameColumn: 'name',
    statusColumn: 'status',
  },
  VENDOR: {
    table: 'suppliers',
    nameColumn: 'company_name',
    statusColumn: 'status',
  },
  MENU: {
    table: 'disposable_menus',
    nameColumn: 'name',
    statusColumn: 'status',
  },
  DELIVERY: {
    table: 'wholesale_deliveries',
    nameColumn: 'id',
    statusColumn: 'status',
  },
  PAYMENT: {
    table: 'payments',
    nameColumn: 'id',
    statusColumn: 'status',
  },
  INVENTORY: {
    table: 'inventory',
    nameColumn: 'id',
    statusColumn: null,
  },
  STOREFRONT: {
    table: 'storefronts',
    nameColumn: 'name',
    statusColumn: 'status',
  },
};

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

const linkResolverKeys = {
  all: ['link-resolver'] as const,
  entity: (tenantId: string, entityType: EntityType, entityId: string) =>
    [...linkResolverKeys.all, tenantId, entityType, entityId] as const,
};

// ---------------------------------------------------------------------------
// Resolution query function
// ---------------------------------------------------------------------------

async function resolveEntity(
  entityType: EntityType,
  entityId: string,
  tenantId: string,
  tenantSlug: string
): Promise<ResolvedEntity> {
  const columns = ENTITY_COLUMN_MAP[entityType];
  if (!columns) {
    logger.warn('[useLinkResolver] Unknown entity type', { entityType, entityId });
    return makeDeletedEntity(entityType, entityId);
  }

  // Build select columns — always include id
  const selectCols = ['id'];
  if (columns.nameColumn !== 'id') selectCols.push(columns.nameColumn);
  if (columns.statusColumn) selectCols.push(columns.statusColumn);
  if (columns.numberColumn) selectCols.push(columns.numberColumn);

  const { data, error } = await supabase
    .from(columns.table)
    .select(selectCols.join(', '))
    .eq('id', entityId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    logger.error('[useLinkResolver] Failed to resolve entity', error, {
      entityType,
      entityId,
      tenantId,
    });
    return makeDeletedEntity(entityType, entityId);
  }

  if (!data) {
    logger.debug('[useLinkResolver] Entity not found (deleted?)', {
      entityType,
      entityId,
    });
    return makeDeletedEntity(entityType, entityId);
  }

  const record = data as Record<string, unknown>;

  // Determine display name
  let name: string;
  if (columns.numberColumn && record[columns.numberColumn]) {
    // For orders, prefer order_number as the name
    name = `${ENTITY_LABELS[entityType]} #${String(record[columns.numberColumn])}`;
  } else if (columns.nameColumn === 'id') {
    // For entities without a name column, use label + short ID
    name = `${ENTITY_LABELS[entityType]} ${String(entityId).slice(0, 8)}`;
  } else {
    name = String(record[columns.nameColumn] ?? `${ENTITY_LABELS[entityType]} ${entityId.slice(0, 8)}`);
  }

  const status = columns.statusColumn
    ? (record[columns.statusColumn] as string | null) ?? null
    : null;

  const url = getEntityRoute(entityType, entityId, tenantSlug);

  return {
    entityType,
    entityId,
    name,
    status,
    url,
    deleted: false,
  };
}

function makeDeletedEntity(entityType: EntityType, entityId: string): ResolvedEntity {
  return {
    entityType,
    entityId,
    name: `${ENTITY_LABELS[entityType] ?? 'Unknown'} (deleted)`,
    status: null,
    url: null,
    deleted: true,
  };
}

// ---------------------------------------------------------------------------
// Single entity resolver hook
// ---------------------------------------------------------------------------

/**
 * Resolve a single entity reference to its display information.
 *
 * @example
 * ```tsx
 * const { resolved, isLoading } = useLinkResolver('ORDER', orderId);
 * if (resolved && !resolved.deleted) {
 *   return <Link to={resolved.url}>{resolved.name}</Link>;
 * }
 * ```
 */
export function useLinkResolver(
  entityType: EntityType,
  entityId: string | undefined | null
): UseLinkResolverReturn {
  const { tenantId, tenantSlug } = useTenantContext();

  const enabled = !!entityId && !!tenantId && !!tenantSlug;

  const { data, isLoading, isError } = useQuery({
    queryKey: linkResolverKeys.entity(tenantId ?? '', entityType, entityId ?? ''),
    queryFn: () => resolveEntity(entityType, entityId!, tenantId!, tenantSlug!),
    enabled,
    staleTime: 60_000, // Cache for 1 minute
    gcTime: 5 * 60_000, // Keep in garbage collection for 5 minutes
  });

  return {
    resolved: data ?? null,
    isLoading: enabled && isLoading,
    isError,
  };
}

// ---------------------------------------------------------------------------
// Batch entity resolver hook
// ---------------------------------------------------------------------------

/**
 * Resolve multiple entity references in parallel with shared caching.
 *
 * @example
 * ```tsx
 * const refs = [
 *   { entityType: 'ORDER' as EntityType, entityId: '123' },
 *   { entityType: 'CUSTOMER' as EntityType, entityId: '456' },
 * ];
 * const { getResolved, isLoading } = useBatchLinkResolver(refs);
 * const order = getResolved('ORDER', '123');
 * ```
 */
export function useBatchLinkResolver(
  refs: EntityReference[]
): UseBatchLinkResolverReturn {
  const { tenantId, tenantSlug } = useTenantContext();

  const enabled = !!tenantId && !!tenantSlug;

  // Deduplicate references
  const uniqueRefs = useMemo(() => {
    const seen = new Set<string>();
    return refs.filter((ref) => {
      if (!ref.entityId) return false;
      const key = `${ref.entityType}:${ref.entityId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [refs]);

  const queries = useQueries({
    queries: uniqueRefs.map((ref) => ({
      queryKey: linkResolverKeys.entity(tenantId ?? '', ref.entityType, ref.entityId),
      queryFn: () => resolveEntity(ref.entityType, ref.entityId, tenantId!, tenantSlug!),
      enabled,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  const resolvedMap = useMemo(() => {
    const map = new Map<string, ResolvedEntity>();
    queries.forEach((q, i) => {
      if (q.data) {
        const ref = uniqueRefs[i];
        map.set(`${ref.entityType}:${ref.entityId}`, q.data);
      }
    });
    return map;
  }, [queries, uniqueRefs]);

  const getResolved = useCallback(
    (entityType: EntityType, entityId: string): ResolvedEntity | null => {
      return resolvedMap.get(`${entityType}:${entityId}`) ?? null;
    },
    [resolvedMap]
  );

  return {
    resolvedMap,
    isLoading: enabled && isLoading,
    isError,
    getResolved,
  };
}
