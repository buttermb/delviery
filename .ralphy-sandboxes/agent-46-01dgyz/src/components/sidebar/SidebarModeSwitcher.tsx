/**
 * Sidebar Mode Switcher
 * 
 * A simple toggle to switch between Classic and Optimized sidebar modes.
 * Can be added to Settings or displayed in the sidebar footer.
 */

import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Layers } from 'lucide-react';
import { useSidebarMode, type SidebarMode } from '@/hooks/useSidebarMode';

interface SidebarModeSwitcherProps {
    variant?: 'card' | 'inline' | 'compact';
    showDescription?: boolean;
}

export function SidebarModeSwitcher({
    variant = 'card',
    showDescription = true,
}: SidebarModeSwitcherProps) {
    const { mode, setMode } = useSidebarMode();

    if (variant === 'compact') {
        return (
            <div className="flex items-center gap-2">
                <Button
                    variant={mode === 'classic' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setMode('classic')}
                    className="h-8"
                >
                    <Layers className="h-4 w-4 mr-1" />
                    Classic
                </Button>
                <Button
                    variant={mode === 'optimized' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setMode('optimized')}
                    className="h-8"
                >
                    <Sparkles className="h-4 w-4 mr-1" />
                    New
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1">BETA</Badge>
                </Button>
            </div>
        );
    }

    if (variant === 'inline') {
        return (
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Sidebar:</span>
                <Select value={mode} onValueChange={(v) => setMode(v as SidebarMode)}>
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="classic">
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Classic
                            </div>
                        </SelectItem>
                        <SelectItem value="optimized">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4" />
                                Optimized (Beta)
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
        );
    }

    // Card variant (default)
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    Sidebar Mode
                    <Badge variant="outline" className="text-xs">Beta</Badge>
                </CardTitle>
                {showDescription && (
                    <CardDescription>
                        Choose between the classic sidebar or try our new task-based navigation
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setMode('classic')}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${mode === 'classic'
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-muted-foreground/30'
                            }`}
                    >
                        <Layers className="h-5 w-5 mb-2 text-muted-foreground" />
                        <div className="font-medium">Classic</div>
                        <div className="text-xs text-muted-foreground">
                            Traditional module-based navigation
                        </div>
                    </button>

                    <button
                        onClick={() => setMode('optimized')}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${mode === 'optimized'
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-muted-foreground/30'
                            }`}
                    >
                        <Sparkles className="h-5 w-5 mb-2 text-amber-500" />
                        <div className="font-medium flex items-center gap-2">
                            Optimized
                            <Badge className="text-[10px] bg-amber-500">NEW</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Task-based with ⌘K search
                        </div>
                    </button>
                </div>

                {mode === 'optimized' && (
                    <p className="text-xs text-muted-foreground">
                        💡 Press <kbd className="px-1 py-0.5 rounded border bg-muted text-xs">⌘K</kbd> to search all features
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export default SidebarModeSwitcher;
