/**
 * StorefrontBuilder - Orchestrator Component
 * Dual-mode builder: Simple (Easy Mode) and Advanced (Full Builder)
 *
 * Simple Mode: Preset packs, feature toggles, basic content editing
 * Advanced Mode: Full drag-and-drop, custom sections, responsive settings
 */

import { useState, useEffect, useCallback } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Loader2 } from 'lucide-react';
import { EasyModeEditor } from '@/components/admin/storefront/EasyModeEditor';
import { useEasyModeBuilder } from '@/hooks/useEasyModeBuilder';
import { detectAdvancedCustomizations } from '@/lib/storefrontPresets';
import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
    BuilderHeader,
    BuilderLeftPanel,
    BuilderPreview,
    BuilderPropertyEditor,
    BuilderCreateStore,
    BuilderMobileDrawer,
    useStorefrontBuilder,
    useBuilderLayout
} from './builder';

interface StorefrontBuilderProps {
    isFullScreen?: boolean;
    onRequestClose?: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
}

export function StorefrontBuilder({
    isFullScreen = true,
    onRequestClose,
    onDirtyChange,
}: StorefrontBuilderProps) {
    const { tenant } = useTenantAdminAuth();
    const { navigateToAdmin } = useTenantNavigation();
    
    // Core advanced builder state and operations
    const builder = useStorefrontBuilder();
    const layout = useBuilderLayout();
    
    // Determine initial mode based on whether advanced edits exist
    const initialMode = detectAdvancedCustomizations(builder.layoutConfig).hasCustomizations 
        ? 'advanced' 
        : 'simple';
        
    const [builderMode, setBuilderMode] = useState<'simple' | 'advanced'>(initialMode);
    
    // Setup Easy Mode Builder
    const easyModeBuilder = useEasyModeBuilder({
        initialThemeConfig: builder.store?.theme_config,
        initialLayoutConfig: builder.layoutConfig,
    });

    // Mode switch confirmation state
    const [pendingModeSwitch, setPendingModeSwitch] = useState<string | null>(null);
    const [modeSwitchWarning, setModeSwitchWarning] = useState('');

    // Handle switching between Simple and Advanced Builder Modes
    const handleModeSwitch = useCallback((newMode: 'simple' | 'advanced') => {
        if (newMode === 'simple') {
            const result = detectAdvancedCustomizations(builder.layoutConfig);
            if (result.hasCustomizations) {
                setModeSwitchWarning(`Switching to Simple Mode may override custom edits in: ${result.customizations.join(', ')}.`);
                setPendingModeSwitch(newMode);
                return;
            }
        } else {
            if (easyModeBuilder.isDirty) {
                builder.setLayoutConfig(easyModeBuilder.derivedLayoutConfig);
                builder.setThemeConfig(easyModeBuilder.derivedThemeConfig);
            }
        }
        setBuilderMode(newMode);
    }, [builder, easyModeBuilder.isDirty, easyModeBuilder.derivedLayoutConfig, easyModeBuilder.derivedThemeConfig]);

    // Handle close/back
    const handleClose = useCallback(() => {
        if (onRequestClose) {
            onRequestClose();
        } else {
            navigateToAdmin('storefront');
        }
    }, [onRequestClose, navigateToAdmin]);

    // Notify parent of dirty state changes
    useEffect(() => {
        if (onDirtyChange) {
            const isDirty = builderMode === 'simple' ? easyModeBuilder.isDirty : false; // TODO: Implement advanced isDirty tracking
            onDirtyChange(isDirty);
        }
    }, [easyModeBuilder.isDirty, builderMode, onDirtyChange]);
    
    if (builder.isLoading) {
        return (
            <div
                className={`flex flex-col bg-muted overflow-hidden ${isFullScreen ? '' : 'h-full'}`}
                style={isFullScreen ? { height: '100vh' } : undefined}
            >
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex flex-col bg-muted overflow-hidden ${isFullScreen ? '' : 'h-full'}`}
            style={isFullScreen ? { height: '100vh' } : undefined}
        >
            {/* No-store empty state */}
            {!builder.store && (
                <BuilderCreateStore
                    newStoreName={builder.newStoreName}
                    setNewStoreName={builder.setNewStoreName}
                    newStoreSlug={builder.newStoreSlug}
                    setNewStoreSlug={builder.setNewStoreSlug}
                    slugError={builder.slugError}
                    isSlugChecking={builder.isValidatingSlug}
                    slugAvailable={!builder.slugError && builder.newStoreSlug.length >= 3 && !builder.isValidatingSlug}
                    setSlugAvailable={() => { /* Handled by validation */ }}
                    generateSlug={builder.generateSlug}
                    handleThemeSelect={builder.handleThemeSelect}
                    selectedThemeId={builder.selectedThemeId}
                    handleCreateStore={builder.handleCreateStore}
                    isCreatingWithCredits={builder.isCreatingWithCredits}
                    isCreatePending={builder.createStoreMutation.isPending}
                />
            )}

            {/* Main Builder Interface */}
            {builder.store && (
                <>
                    <BuilderHeader
                        store={builder.store}
                        isFullScreen={isFullScreen}
                        handleClose={handleClose}
                        devicePreview={builder.devicePreview}
                        setDevicePreview={builder.setDevicePreview}
                        previewZoom={builder.previewZoom}
                        setPreviewZoom={builder.setPreviewZoom}
                        undo={builder.undo}
                        redo={builder.redo}
                        historyIndex={builder.historyIndex}
                        historyLength={builder.history.length}
                        builderMode={builderMode}
                        handleModeSwitch={handleModeSwitch}
                        onSaveDraft={() => builder.saveDraftMutation.mutate()}
                        onPublish={() => builder.publishMutation.mutate()}
                        isSavingDraft={builder.saveDraftMutation.isPending}
                        isSavingSuccess={builder.saveDraftMutation.isSuccess}
                        isPublishing={builder.publishMutation.isPending}
                    />

                    {builderMode === 'simple' ? (
                        /* Simple Mode */
                        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/20">
                            <EasyModeEditor
                                storeId={builder.store.id}
                                storeSlug={builder.store.slug}
                                selectedPresetId={easyModeBuilder.selectedPreset?.id || null}
                                onSelectPreset={easyModeBuilder.selectPreset}
                                featureToggles={easyModeBuilder.featureToggles}
                                onUpdateToggle={easyModeBuilder.updateFeatureToggle}
                                simpleContent={easyModeBuilder.simpleContent}
                                onUpdateContent={easyModeBuilder.updateSimpleContent}
                                onResetToPreset={easyModeBuilder.resetToPreset}
                                onSave={() => {
                                    builder.setLayoutConfig(easyModeBuilder.derivedLayoutConfig);
                                    builder.setThemeConfig(easyModeBuilder.derivedThemeConfig);
                                    builder.saveDraftMutation.mutate();
                                    easyModeBuilder.markClean();
                                }}
                                onPublish={() => builder.publishMutation.mutate()}
                                isSaving={builder.saveDraftMutation.isPending || builder.publishMutation.isPending}
                                isDirty={easyModeBuilder.isDirty}
                            />
                        </div>
                    ) : (
                        /* Advanced Mode */
                        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden relative w-full">
                            {/* Left Panel — hidden on mobile, shown as drawer */}
                            {layout.isMobile ? (
                                <BuilderMobileDrawer
                                    open={layout.leftPanelOpen}
                                    onOpenChange={layout.setLeftPanelOpen}
                                    title="Builder Panel"
                                >
                                    <BuilderLeftPanel
                                        activeTab={builder.activeTab}
                                        setActiveTab={builder.setActiveTab}
                                        layoutConfig={builder.layoutConfig}
                                        setLayoutConfig={builder.setLayoutConfig}
                                        themeConfig={builder.themeConfig}
                                        setThemeConfig={builder.setThemeConfig}
                                        selectedThemeId={builder.selectedThemeId}
                                        onSelectThemePreset={builder.handleThemeSelect}
                                        selectedSectionId={builder.selectedSectionId}
                                        onAddSection={builder.addSection}
                                        onSelectSection={builder.handleSelectSection}
                                        onRemoveSection={builder.requestRemoveSection}
                                        onDuplicateSection={builder.duplicateSection}
                                        onToggleVisibility={builder.toggleVisibility}
                                        onApplyTemplate={builder.applyTemplate}
                                        saveToHistory={builder.saveToHistory}
                                    />
                                </BuilderMobileDrawer>
                            ) : (
                                <BuilderLeftPanel
                                    activeTab={builder.activeTab}
                                    setActiveTab={builder.setActiveTab}
                                    layoutConfig={builder.layoutConfig}
                                    setLayoutConfig={builder.setLayoutConfig}
                                    themeConfig={builder.themeConfig}
                                    setThemeConfig={builder.setThemeConfig}
                                    selectedThemeId={builder.selectedThemeId}
                                    onSelectThemePreset={builder.handleThemeSelect}
                                    selectedSectionId={builder.selectedSectionId}
                                    onAddSection={builder.addSection}
                                    onSelectSection={builder.handleSelectSection}
                                    onRemoveSection={builder.requestRemoveSection}
                                    onDuplicateSection={builder.duplicateSection}
                                    onToggleVisibility={builder.toggleVisibility}
                                    onApplyTemplate={builder.applyTemplate}
                                    saveToHistory={builder.saveToHistory}
                                />
                            )}

                            <BuilderPreview
                                store={builder.store}
                                layoutConfig={builder.layoutConfig}
                                setLayoutConfig={builder.setLayoutConfig}
                                saveToHistory={builder.saveToHistory}
                                themeConfig={builder.themeConfig}
                                devicePreview={builder.devicePreview}
                                previewZoom={builder.previewZoom}
                                selectedSectionId={builder.selectedSectionId}
                                onSelectSection={builder.handleSelectSection}
                                onApplyTemplate={builder.applyTemplate}
                                setActiveTab={builder.setActiveTab}
                                tenantId={tenant?.id}
                            />

                            {/* Right Panel — mobile drawer or inline */}
                            {builder.selectedSection && (
                                layout.isMobile ? (
                                    <BuilderMobileDrawer
                                        open={builder.rightPanelOpen}
                                        onOpenChange={builder.setRightPanelOpen}
                                        title={`Edit Section`}
                                    >
                                        <BuilderPropertyEditor
                                            selectedSection={builder.selectedSection}
                                            onClose={() => builder.setRightPanelOpen(false)}
                                            onUpdateSection={builder.updateSection}
                                        />
                                    </BuilderMobileDrawer>
                                ) : builder.rightPanelOpen ? (
                                    <BuilderPropertyEditor
                                        selectedSection={builder.selectedSection}
                                        onClose={() => builder.setRightPanelOpen(false)}
                                        onUpdateSection={builder.updateSection}
                                    />
                                ) : null
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Modals & Dialogs */}
            <ConfirmDeleteDialog
                open={!!builder.sectionToDelete}
                onOpenChange={(open) => !open && builder.cancelRemoveSection()}
                onConfirm={builder.confirmRemoveSection}
                title="Delete Section?"
                description="Are you sure you want to delete this section? This action cannot be undone."
                itemType="section"
            />

            <OutOfCreditsModal
                open={builder.showOutOfCreditsModal}
                onOpenChange={(open) => { if (!open) builder.closeOutOfCreditsModal(); }}
                actionAttempted={builder.blockedAction ?? undefined}
            />

            <AlertDialog open={!!pendingModeSwitch} onOpenChange={(open) => !open && setPendingModeSwitch(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Switch to Simple Mode?</AlertDialogTitle>
                        <AlertDialogDescription>{modeSwitchWarning}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            if (pendingModeSwitch) {
                                setBuilderMode(pendingModeSwitch as 'simple' | 'advanced');
                                setPendingModeSwitch(null);
                            }
                        }}>
                            Switch Anyway
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
