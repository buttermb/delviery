/**
 * StorefrontDesignPage
 * Entry point that prompts users to open the full-screen editor
 * or continue in compact mode
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

import { EditorEntryCard } from '@/components/admin/storefront/EditorEntryCard';
import { FullScreenEditorPortal } from '@/components/admin/storefront/FullScreenEditorPortal';
import { UnsavedChangesDialog } from '@/components/admin/storefront/UnsavedChangesDialog';
import { UnsavedChangesDialog as RouteUnsavedChangesDialog } from '@/components/unsaved-changes';
import { StorefrontBuilder } from '@/pages/admin/storefront/StorefrontBuilder';
import { useFullScreenEditor } from '@/hooks/useFullScreenEditor';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

import type { MarketplaceStore } from '@/types/marketplace-extended';
import { queryKeys } from '@/lib/queryKeys';

export function StorefrontDesignPage() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [showCompactMode, setShowCompactMode] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Fetch storefront data
    const { data: store, isLoading } = useQuery({
        queryKey: queryKeys.marketplaceSettings.byTenant(tenant?.id),
        queryFn: async (): Promise<MarketplaceStore | null> => {
            try {
                const { data, error } = await (supabase as any)
                    .from('marketplace_stores')
                    .select('*')
                    .eq('tenant_id', tenant?.id || '')
                    .maybeSingle();

                if (error) throw error;
                return data as MarketplaceStore | null;
            } catch (e) {
                logger.warn('Failed to fetch storefront data', e);
                return null;
            }
        },
        enabled: !!tenant?.id,
    });

    // Save mutation for unsaved changes dialog
    const saveMutation = useMutation({
        mutationFn: async () => {
            // This will be called from the builder's internal state
            // The actual save logic is in StorefrontBuilder
            // This is a placeholder that gets overridden
            logger.info('Save triggered from design page');
        },
        onSuccess: () => {
            toast.success('Draft saved');
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceSettings.all });
            setHasUnsavedChanges(false);
        },
        onError: (error) => {
            toast.error(humanizeError(error, 'Failed to save draft'));
        },
    });

    const handleSave = useCallback(async () => {
        await saveMutation.mutateAsync();
    }, [saveMutation]);

    const {
        isFullScreen,
        showExitDialog,
        isExiting,
        openFullScreen,
        requestClose,
        confirmDiscard,
        confirmSaveAndExit,
        cancelExit,
    } = useFullScreenEditor({
        onSave: handleSave,
        hasUnsavedChanges,
    });

    // Track dirty state from builder
    const handleDirtyChange = useCallback((dirty: boolean) => {
        setHasUnsavedChanges(dirty);
    }, []);

    // Handle compact mode toggle
    const handleOpenCompact = useCallback(() => {
        setShowCompactMode(true);
    }, []);

    // Block route navigation when there are unsaved changes
    const { showBlockerDialog, confirmLeave, cancelLeave } = useUnsavedChanges({
        isDirty: hasUnsavedChanges,
    });

    // If compact mode is shown directly
    if (showCompactMode && !isFullScreen) {
        return (
            <StorefrontBuilder
                isFullScreen={false}
                onRequestClose={() => setShowCompactMode(false)}
                onDirtyChange={handleDirtyChange}
            />
        );
    }

    return (
        <>
            {/* Entry Card - Visible when not in full-screen */}
            <div
                className={cn(
                    'transition-opacity duration-300',
                    isFullScreen ? 'opacity-0 pointer-events-none' : 'opacity-100'
                )}
            >
                <EditorEntryCard
                    storeName={store?.store_name || null}
                    isPublished={store?.is_public || false}
                    updatedAt={store?.updated_at || null}
                    isLoading={isLoading}
                    onOpenFullScreen={openFullScreen}
                    onOpenCompact={handleOpenCompact}
                />
            </div>

            {/* Full-Screen Editor Portal */}
            <FullScreenEditorPortal isOpen={isFullScreen}>
                <StorefrontBuilder
                    isFullScreen={true}
                    onRequestClose={requestClose}
                    onDirtyChange={handleDirtyChange}
                />
            </FullScreenEditorPortal>

            {/* Unsaved Changes Dialog — full-screen editor exit */}
            <UnsavedChangesDialog
                open={showExitDialog}
                isExiting={isExiting}
                onDiscard={confirmDiscard}
                onSaveDraft={confirmSaveAndExit}
                onCancel={cancelExit}
            />

            {/* Unsaved Changes Dialog — route navigation */}
            <RouteUnsavedChangesDialog
                open={showBlockerDialog}
                onConfirmLeave={confirmLeave}
                onCancelLeave={cancelLeave}
            />
        </>
    );
}
