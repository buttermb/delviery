/**
 * BuilderHeader
 * Top toolbar with device preview, undo/redo, zoom, and action buttons
 */

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    ArrowLeft, Monitor, Tablet, Smartphone,
    Undo2, Redo2, ZoomIn, ZoomOut,
    Save, Globe, GlobeLock, Eye, Store, Loader2
} from 'lucide-react';
import { MarketplaceStore } from '@/types/marketplace-extended';

interface BuilderHeaderProps {
    store: MarketplaceStore | undefined;
    isLoading: boolean;
    devicePreview: 'desktop' | 'tablet' | 'mobile';
    setDevicePreview: (device: 'desktop' | 'tablet' | 'mobile') => void;
    previewZoom: number;
    setPreviewZoom: (zoom: number) => void;
    historyIndex: number;
    historyLength: number;
    undo: () => void;
    redo: () => void;
    rightPanelOpen: boolean;
    setRightPanelOpen: (open: boolean) => void;
    hasSelectedSection: boolean;
    onCreateStore: () => void;
    onSaveDraft: () => void;
    isSaving: boolean;
    onPublish: () => void;
    isPublishing: boolean;
    onUnpublish: () => void;
    isUnpublishing: boolean;
    onBack?: () => void;
}

export function BuilderHeader({
    store,
    isLoading,
    devicePreview,
    setDevicePreview,
    previewZoom,
    setPreviewZoom,
    historyIndex,
    historyLength,
    undo,
    redo,
    rightPanelOpen,
    setRightPanelOpen,
    hasSelectedSection,
    onCreateStore,
    onSaveDraft,
    isSaving,
    onPublish,
    isPublishing,
    onUnpublish,
    isUnpublishing,
    onBack,
}: BuilderHeaderProps) {
    return (
        <div className="flex items-center justify-between px-6 py-3 bg-background border-b shrink-0 z-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to storefront">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <span className="font-semibold">Store Builder</span>
                <div className="flex rounded-md bg-muted p-1">
                    <Button
                        variant={devicePreview === 'desktop' ? 'secondary' : 'ghost'}
                        size="icon" className="h-11 w-11"
                        onClick={() => setDevicePreview('desktop')} aria-label="Desktop preview"><Monitor className="w-4 h-4" /></Button>
                    <Button
                        variant={devicePreview === 'tablet' ? 'secondary' : 'ghost'}
                        size="icon" className="h-11 w-11"
                        onClick={() => setDevicePreview('tablet')} aria-label="Tablet preview"><Tablet className="w-4 h-4" /></Button>
                    <Button
                        variant={devicePreview === 'mobile' ? 'secondary' : 'ghost'}
                        size="icon" className="h-11 w-11"
                        onClick={() => setDevicePreview('mobile')} aria-label="Mobile preview"><Smartphone className="w-4 h-4" /></Button>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        aria-label="Undo"
                    >
                        <Undo2 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        onClick={redo}
                        disabled={historyIndex >= historyLength - 1}
                        aria-label="Redo"
                    >
                        <Redo2 className="w-4 h-4" />
                    </Button>
                </div>
                <Separator orientation="vertical" className="h-6" />
                {/* Zoom controls */}
                <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 sm:h-6 sm:w-6"
                        onClick={() => setPreviewZoom(Math.max(0.5, previewZoom - 0.1))}
                        disabled={previewZoom <= 0.5}
                        aria-label="Zoom out"
                    >
                        <ZoomOut className="w-3 h-3" />
                    </Button>
                    <span className="text-xs w-10 text-center">{Math.round(previewZoom * 100)}%</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 sm:h-6 sm:w-6"
                        onClick={() => setPreviewZoom(Math.min(1.2, previewZoom + 0.1))}
                        disabled={previewZoom >= 1.2}
                        aria-label="Zoom in"
                    >
                        <ZoomIn className="w-3 h-3" />
                    </Button>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {/* Store status indicator */}
                {store && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs">
                        {store.is_public ? (
                            <>
                                <Globe className="w-3 h-3 text-green-500" />
                                <span className="text-green-700 dark:text-green-400">Published</span>
                            </>
                        ) : (
                            <>
                                <GlobeLock className="w-3 h-3 text-yellow-500" />
                                <span className="text-yellow-700 dark:text-yellow-400">Draft</span>
                            </>
                        )}
                    </div>
                )}
                {/* Toggle right panel button when closed */}
                {hasSelectedSection && !rightPanelOpen && (
                    <Button variant="outline" size="sm" onClick={() => setRightPanelOpen(true)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Edit Section
                    </Button>
                )}
                {/* Create Store button when no store exists */}
                {!store && !isLoading && (
                    <Button onClick={onCreateStore}>
                        <Store className="w-4 h-4 mr-2" />
                        Create Store (500 credits)
                    </Button>
                )}
                {/* Save Draft button */}
                {store && (
                    <Button
                        variant="outline"
                        onClick={onSaveDraft}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {isSaving ? 'Saving...' : 'Save Draft'}
                    </Button>
                )}
                {/* Publish / Unpublish button */}
                {store && (
                    store.is_public ? (
                        <Button
                            variant="outline"
                            onClick={onUnpublish}
                            disabled={isUnpublishing}
                        >
                            {isUnpublishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GlobeLock className="w-4 h-4 mr-2" />}
                            {isUnpublishing ? 'Unpublishing...' : 'Unpublish'}
                        </Button>
                    ) : (
                        <Button
                            onClick={onPublish}
                            disabled={isPublishing}
                        >
                            {isPublishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
                            {isPublishing ? 'Publishing...' : 'Publish'}
                        </Button>
                    )
                )}
            </div>
        </div>
    );
}
