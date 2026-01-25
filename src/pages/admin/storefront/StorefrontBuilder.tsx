/**
 * StorefrontBuilder - Orchestrator Component
 * Composes the modular builder sub-components with shared state from useStorefrontBuilder hook.
 *
 * Sub-modules in ./builder/:
 *  - storefront-builder.config.ts  → Section types, templates, defaults, shared types
 *  - useStorefrontBuilder.ts       → All state management, mutations, and actions
 *  - BuilderHeader.tsx             → Top toolbar (device preview, undo/redo, zoom, actions)
 *  - BuilderLeftPanel.tsx          → Left sidebar (sections, theme, templates tabs)
 *  - BuilderPreview.tsx            → Center preview area with device scaling
 *  - BuilderPropertyEditor.tsx     → Right sidebar (content/styles property editor)
 *  - BuilderCreateStoreDialog.tsx  → Store creation dialog with slug validation
 *  - SortableSectionItem.tsx       → Draggable section item for the section list
 */

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal';
import {
    BuilderHeader,
    BuilderLeftPanel,
    BuilderPreview,
    BuilderPropertyEditor,
    BuilderCreateStoreDialog,
    useStorefrontBuilder,
} from './builder';

export function StorefrontBuilder() {
    const builder = useStorefrontBuilder();

    return (
        <div className="flex flex-col bg-muted overflow-hidden -m-3 sm:-m-4 md:-m-6 w-full" style={{ height: 'calc(100vh - 56px)' }}>
            {/* Header */}
            <BuilderHeader
                store={builder.store}
                isLoading={builder.isLoading}
                devicePreview={builder.devicePreview}
                setDevicePreview={builder.setDevicePreview}
                previewZoom={builder.previewZoom}
                setPreviewZoom={builder.setPreviewZoom}
                historyIndex={builder.historyIndex}
                historyLength={builder.history.length}
                undo={builder.undo}
                redo={builder.redo}
                rightPanelOpen={builder.rightPanelOpen}
                setRightPanelOpen={builder.setRightPanelOpen}
                hasSelectedSection={!!builder.selectedSection}
                onCreateStore={() => builder.setShowCreateDialog(true)}
                onSaveDraft={() => builder.saveDraftMutation.mutate()}
                isSaving={builder.saveDraftMutation.isPending}
                onPublish={() => builder.publishMutation.mutate()}
                isPublishing={builder.publishMutation.isPending}
                onUnpublish={() => builder.unpublishMutation.mutate()}
                isUnpublishing={builder.unpublishMutation.isPending}
            />

            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left Sidebar */}
                <BuilderLeftPanel
                    activeTab={builder.activeTab}
                    setActiveTab={builder.setActiveTab}
                    layoutConfig={builder.layoutConfig}
                    setLayoutConfig={builder.setLayoutConfig}
                    themeConfig={builder.themeConfig}
                    setThemeConfig={builder.setThemeConfig}
                    selectedSectionId={builder.selectedSectionId}
                    onAddSection={builder.addSection}
                    onSelectSection={builder.handleSelectSection}
                    onRemoveSection={builder.requestRemoveSection}
                    onDuplicateSection={builder.duplicateSection}
                    onToggleVisibility={builder.toggleVisibility}
                    onApplyTemplate={builder.applyTemplate}
                    saveToHistory={builder.saveToHistory}
                />

                {/* Center Preview */}
                <BuilderPreview
                    store={builder.store}
                    layoutConfig={builder.layoutConfig}
                    themeConfig={builder.themeConfig}
                    devicePreview={builder.devicePreview}
                    previewZoom={builder.previewZoom}
                    selectedSectionId={builder.selectedSectionId}
                    onSelectSection={builder.handleSelectSection}
                    onApplyTemplate={builder.applyTemplate}
                    setActiveTab={builder.setActiveTab}
                />

                {/* Right Property Editor */}
                {builder.selectedSection && builder.rightPanelOpen && (
                    <BuilderPropertyEditor
                        selectedSection={builder.selectedSection}
                        onClose={() => builder.setRightPanelOpen(false)}
                        onUpdateSection={builder.updateSection}
                    />
                )}
            </div>

            {/* Create Store Dialog */}
            <BuilderCreateStoreDialog
                open={builder.showCreateDialog}
                onOpenChange={builder.setShowCreateDialog}
                storeName={builder.newStoreName}
                onStoreNameChange={builder.setNewStoreName}
                storeSlug={builder.newStoreSlug}
                onStoreSlugChange={builder.setNewStoreSlug}
                slugError={builder.slugError}
                onSlugErrorChange={builder.setSlugError}
                isValidatingSlug={builder.isValidatingSlug}
                generateSlug={builder.generateSlug}
                validateSlug={builder.validateSlug}
                onSubmit={builder.handleCreateStore}
                isSubmitting={builder.isCreatingWithCredits || builder.createStoreMutation.isPending}
            />

            {/* Delete Section Confirmation Dialog */}
            <AlertDialog open={!!builder.sectionToDelete} onOpenChange={(open) => !open && builder.cancelRemoveSection()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Section?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this section? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={builder.cancelRemoveSection}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={builder.confirmRemoveSection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Out of Credits Modal */}
            <OutOfCreditsModal
                open={builder.showOutOfCreditsModal}
                onOpenChange={builder.closeOutOfCreditsModal}
                actionAttempted={builder.blockedAction ?? undefined}
            />
        </div>
    );
}

// Default export for lazy loading compatibility
export default StorefrontBuilder;
