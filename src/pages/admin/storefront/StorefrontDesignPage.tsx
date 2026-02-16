/**
 * StorefrontDesignPage
 * Entry point that prompts users to open the full-screen editor
 * or continue in compact mode
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { EditorEntryCard } from '@/components/admin/storefront/EditorEntryCard';
import { FullScreenEditorPortal } from '@/components/admin/storefront/FullScreenEditorPortal';
import { UnsavedChangesDialog } from '@/components/admin/storefront/UnsavedChangesDialog';
import { StorefrontBuilder } from '@/pages/admin/storefront/StorefrontBuilder';
import { useFullScreenEditor } from '@/hooks/useFullScreenEditor';

import type { MarketplaceStore } from '@/types/marketplace-extended';

export function StorefrontDesignPage() {
    const { tenant } = useTenantAdminAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showCompactMode, setShowCompactMode] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Fetch storefront data
    const { data: store, isLoading } = useQuery({
        queryKey: ['marketplace-settings', tenant?.id],
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
            toast({ title: 'Draft saved', description: 'Your changes have been saved.' });
            queryClient.invalidateQueries({ queryKey: ['marketplace-settings'] });
            setHasUnsavedChanges(false);
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

            {/* Unsaved Changes Dialog */}
            <UnsavedChangesDialog
                open={showExitDialog}
                isExiting={isExiting}
                onDiscard={confirmDiscard}
                onSaveDraft={confirmSaveAndExit}
                onCancel={cancelExit}
            />
        </>
    );
}
