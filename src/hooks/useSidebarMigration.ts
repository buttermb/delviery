/**
 * Sidebar Migration Hook
 * 
 * Automatically runs storage migration on first load
 * Ensures user preferences are transferred from localStorage to database
 */

import { useEffect, useState } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { migrateLocalStorageToDatabase } from '@/lib/sidebar/migrateLocalStorageToDatabase';
import { logger } from '@/lib/logger';

export function useSidebarMigration() {
  const { tenant, admin } = useTenantAdminAuth();
  const [migrationStatus, setMigrationStatus] = useState<'pending' | 'running' | 'complete' | 'failed'>('pending');

  useEffect(() => {
    if (!tenant?.id || !admin?.id) return;

    const runMigration = async () => {
      setMigrationStatus('running');

      try {
        const result = await migrateLocalStorageToDatabase(tenant.id, admin.id);
        
        if (result.success) {
          setMigrationStatus('complete');
          if (result.migrated) {
            logger.info('Sidebar preferences migrated successfully', {
              component: 'useSidebarMigration',
              tenantId: tenant.id,
              userId: admin.id,
            });
          }
        } else {
          setMigrationStatus('failed');
          logger.warn('Sidebar migration failed', {
            component: 'useSidebarMigration',
            error: result.error,
          });
        }
      } catch (error) {
        setMigrationStatus('failed');
        logger.error('Migration exception', error, { component: 'useSidebarMigration' });
      }
    };

    runMigration();
  }, [tenant?.id, admin?.id]);

  return { migrationStatus };
}
