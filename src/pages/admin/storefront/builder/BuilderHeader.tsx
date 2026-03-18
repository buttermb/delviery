/**
 * BuilderHeader
 * Top navigation bar for Storefront Builder
 */

import { X, ArrowLeft, Monitor, Tablet, Smartphone, Undo2, Redo2, ZoomOut, ZoomIn, Globe, GlobeLock, Wand2, Settings2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SaveButton } from '@/components/ui/save-button';
import { MarketplaceStore } from '@/types/marketplace-extended';

interface BuilderHeaderProps {
    store: MarketplaceStore | undefined;
    isFullScreen: boolean;
    handleClose: () => void;
    devicePreview: 'desktop' | 'tablet' | 'mobile';
    setDevicePreview: (mode: 'desktop' | 'tablet' | 'mobile') => void;
    previewZoom: number;
    setPreviewZoom: (zoom: number) => void;
    undo: () => void;
    redo: () => void;
    historyIndex: number;
    historyLength: number;
    builderMode: 'simple' | 'advanced';
    handleModeSwitch: (mode: 'simple' | 'advanced') => void;
    onSaveDraft: () => void;
    onPublish: () => void;
    isSavingDraft: boolean;
    isSavingSuccess: boolean;
    isPublishing: boolean;
}

export function BuilderHeader({
    store,
    isFullScreen,
    handleClose,
    devicePreview,
    setDevicePreview,
    previewZoom,
    setPreviewZoom,
    undo,
    redo,
    historyIndex,
    historyLength,
    builderMode,
    handleModeSwitch,
    onSaveDraft,
    onPublish,
    isSavingDraft,
    isSavingSuccess,
    isPublishing,
}: BuilderHeaderProps) {
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-background border-b shrink-0 z-20">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={handleClose} aria-label={isFullScreen ? 'Close editor' : 'Back'}>
                    {isFullScreen ? <X className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                </Button>
                <span className="font-semibold">{isFullScreen ? 'Storefront Editor' : 'Store Builder'}</span>
                
                <div className="flex rounded-md bg-muted p-1 hidden md:flex">
                    <Button
                        variant={devicePreview === 'desktop' ? 'secondary' : 'ghost'}
                        size="icon" className="h-9 w-9"
                        onClick={() => setDevicePreview('desktop')} aria-label="Desktop preview"><Monitor className="w-4 h-4" /></Button>
                    <Button
                        variant={devicePreview === 'tablet' ? 'secondary' : 'ghost'}
                        size="icon" className="h-9 w-9"
                        onClick={() => setDevicePreview('tablet')} aria-label="Tablet preview"><Tablet className="w-4 h-4" /></Button>
                    <Button
                        variant={devicePreview === 'mobile' ? 'secondary' : 'ghost'}
                        size="icon" className="h-9 w-9"
                        onClick={() => setDevicePreview('mobile')} aria-label="Mobile preview"><Smartphone className="w-4 h-4" /></Button>
                </div>
                
                <Separator orientation="vertical" className="h-6 hidden md:block" />
                
                <div className="flex gap-1 hidden md:flex">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        aria-label="Undo"
                    >
                        <Undo2 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={redo}
                        disabled={historyIndex >= historyLength - 1}
                        aria-label="Redo"
                    >
                        <Redo2 className="w-4 h-4" />
                    </Button>
                </div>
                
                <Separator orientation="vertical" className="h-6 hidden lg:block" />
                
                {/* Zoom controls */}
                <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 hidden lg:flex">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
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
                        className="h-8 w-8"
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
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs">
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

                {/* Mode Toggle */}
                <div className="flex bg-muted p-1 rounded-md ml-2 mr-2">
                    <Button
                        variant={builderMode === 'simple' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={() => handleModeSwitch('simple')}
                    >
                        <Wand2 className="w-3 h-3" /> <span className="hidden sm:inline">Simple</span>
                    </Button>
                    <Button
                        variant={builderMode === 'advanced' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={() => handleModeSwitch('advanced')}
                    >
                        <Settings2 className="w-3 h-3" /> <span className="hidden sm:inline">Advanced</span>
                    </Button>
                </div>

                <SaveButton
                    isPending={isSavingDraft}
                    isSuccess={isSavingSuccess}
                    disabled={isPublishing}
                    onClick={onSaveDraft}
                    variant="outline"
                    size="sm"
                >
                    Save Draft
                </SaveButton>
                <Button
                    disabled={isPublishing}
                    onClick={onPublish}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                >
                    {isPublishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Publish
                </Button>
            </div>
        </div>
    );
}
