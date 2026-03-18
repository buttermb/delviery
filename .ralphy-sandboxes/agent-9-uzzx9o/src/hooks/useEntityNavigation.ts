/**
 * Entity Navigation Hook
 *
 * Provides centralized navigation functions for cross-module entity links.
 * This is the single source of truth for navigating to entity detail pages.
 *
 * Uses ENTITY_ROUTES from constants and tenant context for route generation.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { type EntityType, getEntityRoute, ENTITY_ROUTES } from '@/lib/constants/entityTypes';
import { useTenantContext } from '@/hooks/useTenantContext';
import { logger } from '@/lib/logger';

export interface EntityNavigationResult {
  /**
   * Navigate to an entity's detail page
   * @param entityType - The type of entity (ORDER, PRODUCT, etc.)
   * @param entityId - The unique identifier of the entity
   */
  navigateToEntity: (entityType: EntityType, entityId: string) => void;

  /**
   * Get the URL for an entity's detail page without navigating
   * @param entityType - The type of entity (ORDER, PRODUCT, etc.)
   * @param entityId - The unique identifier of the entity
   * @returns The full URL path including tenant slug
   */
  getEntityUrl: (entityType: EntityType, entityId: string) => string | null;

  /**
   * Navigate to an entity list page (without entity ID)
   * @param entityType - The type of entity (ORDER, PRODUCT, etc.)
   */
  navigateToEntityList: (entityType: EntityType) => void;

  /**
   * Get the URL for an entity list page without navigating
   * @param entityType - The type of entity (ORDER, PRODUCT, etc.)
   * @returns The full URL path including tenant slug
   */
  getEntityListUrl: (entityType: EntityType) => string | null;

  /**
   * Whether the hook is ready to use (has tenant context)
   */
  isReady: boolean;
}

/**
 * Hook for cross-module entity navigation.
 *
 * @example
 * ```tsx
 * const { navigateToEntity, getEntityUrl } = useEntityNavigation();
 *
 * // Navigate to an order detail page
 * navigateToEntity('ORDER', orderId);
 *
 * // Get URL for a product to use in a link
 * const productUrl = getEntityUrl('PRODUCT', productId);
 * ```
 */
export function useEntityNavigation(): EntityNavigationResult {
  const navigate = useNavigate();
  const { tenantSlug, isReady } = useTenantContext();

  /**
   * Get the full URL for an entity detail page
   */
  const getEntityUrl = useCallback(
    (entityType: EntityType, entityId: string): string | null => {
      if (!tenantSlug) {
        logger.debug('[useEntityNavigation] Cannot generate URL - no tenant slug', {
          entityType,
          entityId,
        });
        return null;
      }

      const url = getEntityRoute(entityType, entityId, tenantSlug);
      logger.debug('[useEntityNavigation] Generated entity URL', {
        entityType,
        entityId,
        url,
      });

      return url;
    },
    [tenantSlug]
  );

  /**
   * Navigate to an entity detail page
   */
  const navigateToEntity = useCallback(
    (entityType: EntityType, entityId: string): void => {
      const url = getEntityUrl(entityType, entityId);

      if (!url) {
        logger.warn('[useEntityNavigation] Cannot navigate - URL generation failed', {
          entityType,
          entityId,
          hasTenantSlug: !!tenantSlug,
        });
        return;
      }

      logger.debug('[useEntityNavigation] Navigating to entity', {
        entityType,
        entityId,
        url,
      });

      navigate(url);
    },
    [getEntityUrl, navigate, tenantSlug]
  );

  /**
   * Get the full URL for an entity list page (without entity ID)
   */
  const getEntityListUrl = useCallback(
    (entityType: EntityType): string | null => {
      if (!tenantSlug) {
        logger.debug('[useEntityNavigation] Cannot generate list URL - no tenant slug', {
          entityType,
        });
        return null;
      }

      const baseRoute = ENTITY_ROUTES[entityType];
      // Remove any query param suffix for list URLs (e.g., "?tab=products&product=" becomes "?tab=products")
      const listRoute = baseRoute.includes('=')
        ? baseRoute.substring(0, baseRoute.lastIndexOf('='))
        : baseRoute;

      const url = `/${tenantSlug}${listRoute}`;

      logger.debug('[useEntityNavigation] Generated entity list URL', {
        entityType,
        url,
      });

      return url;
    },
    [tenantSlug]
  );

  /**
   * Navigate to an entity list page
   */
  const navigateToEntityList = useCallback(
    (entityType: EntityType): void => {
      const url = getEntityListUrl(entityType);

      if (!url) {
        logger.warn('[useEntityNavigation] Cannot navigate to list - URL generation failed', {
          entityType,
          hasTenantSlug: !!tenantSlug,
        });
        return;
      }

      logger.debug('[useEntityNavigation] Navigating to entity list', {
        entityType,
        url,
      });

      navigate(url);
    },
    [getEntityListUrl, navigate, tenantSlug]
  );

  return useMemo(
    () => ({
      navigateToEntity,
      getEntityUrl,
      navigateToEntityList,
      getEntityListUrl,
      isReady,
    }),
    [navigateToEntity, getEntityUrl, navigateToEntityList, getEntityListUrl, isReady]
  );
}

export default useEntityNavigation;
