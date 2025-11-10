/**
 * Menu Sync Utilities
 * Handles automatic syncing of products to disposable menus
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface MenuSyncResult {
  message: string;
  synced: boolean;
  results?: Array<{
    menu_id: string;
    success: boolean;
    already_exists?: boolean;
    error?: string;
  }>;
}

/**
 * Sync product to disposable menus
 */
export async function syncProductToMenus(
  productId: string,
  tenantId: string,
  menuIds?: string[]
): Promise<MenuSyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke<MenuSyncResult>(
      'sync-product-to-menu',
      {
        body: {
          product_id: productId,
          tenant_id: tenantId,
          menu_ids: menuIds,
        },
      }
    );

    if (error) {
      logger.error('Menu sync failed', error, {
        component: 'menuSync',
        productId,
        tenantId,
      });
      // Don't throw - allow product creation to succeed even if menu sync fails
      return {
        message: 'Menu sync failed (product created successfully)',
        synced: false,
      };
    }

    return data || { message: 'Menu sync completed', synced: true };
  } catch (error) {
    logger.error('Menu sync error', error, {
      component: 'menuSync',
    });
    // Return failure but don't throw - product creation should still succeed
    return {
      message: 'Menu sync error (product created successfully)',
      synced: false,
    };
  }
}

/**
 * Check if product should be visible in menus
 */
export function shouldProductBeInMenus(
  availableQuantity: number | null,
  menuVisibility: boolean | null
): boolean {
  return (availableQuantity ?? 0) > 0 && (menuVisibility ?? true);
}

