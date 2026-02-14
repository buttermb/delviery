/**
 * EditorEntryCard Component
 * Inviting card that prompts users to open the full-screen editor
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Palette, Maximize2, Loader2, Layout, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface EditorEntryCardProps {
    storeName: string | null;
    isPublished: boolean;
    updatedAt: string | null;
    isLoading: boolean;
    onOpenFullScreen: () => void;
    onOpenCompact?: () => void;
}

export function EditorEntryCard({
    storeName,
    isPublished,
    updatedAt,
    isLoading,
    onOpenFullScreen,
    onOpenCompact,
}: EditorEntryCardProps) {
    const hasExistingStorefront = !!storeName;

    const formatRelativeTime = (dateString: string | null) => {
        if (!dateString) return 'Never';
        try {
            return formatDistanceToNow(new Date(dateString), { addSuffix: true });
        } catch {
            return 'Unknown';
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-6">
            <Card className="max-w-xl w-full overflow-hidden shadow-lg">
                {/* Visual Header */}
                <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
                        <Palette className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {hasExistingStorefront ? 'Edit Your Storefront' : 'Design Your Storefront'}
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                        Open the full-screen editor for the best design experience with
                        live preview, drag-and-drop sections, and instant theme switching.
                    </p>
                </div>

                {/* Stats/Preview (if existing storefront) */}
                {hasExistingStorefront && (
                    <div className="px-6 py-4 border-t border-b bg-muted/30">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                                Last edited: {formatRelativeTime(updatedAt)}
                            </span>
                            <Badge variant={isPublished ? 'default' : 'secondary'}>
                                {isPublished ? 'Published' : 'Draft'}
                            </Badge>
                        </div>
                    </div>
                )}

                {/* Features list */}
                <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Layout className="w-4 h-4 text-primary" />
                        <span>Drag & Drop</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>Live Preview</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Palette className="w-4 h-4 text-primary" />
                        <span>Theme Presets</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Maximize2 className="w-4 h-4 text-primary" />
                        <span>Full Screen</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 space-y-4">
                    <Button
                        size="lg"
                        className="w-full h-14 text-lg gap-3"
                        onClick={onOpenFullScreen}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Maximize2 className="w-5 h-5" />
                        )}
                        Open Full-Screen Editor
                    </Button>

                    {onOpenCompact && (
                        <button
                            onClick={onOpenCompact}
                            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            or continue in compact mode →
                        </button>
                    )}

                    <p className="text-center text-sm text-muted-foreground">
                        Press{' '}
                        <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono border">
                            ESC
                        </kbd>{' '}
                        anytime to exit
                    </p>
                </div>
            </Card>
        </div>
    );
}
