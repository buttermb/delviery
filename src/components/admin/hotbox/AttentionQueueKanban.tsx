/**
 * Attention Queue Kanban Component
 * 
 * Three-column Kanban view for attention items:
 * - 🔴 URGENT: Critical priority items
 * - ⚠️ TODAY: Important items needing action today
 * - 📋 UPCOMING: Info-level items for later
 * 
 * Features:
 * - Visual priority columns
 * - Click card for action
 * - Responsive mobile stacking
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
    ChevronRight,
    AlertCircle,
    Clock,
    Calendar,
    DollarSign,
    ExternalLink,
} from 'lucide-react';
import { getCategoryColor } from '@/lib/hotbox/attentionQueue';
import { AttentionItem } from '@/types/hotbox';

interface AttentionQueueKanbanProps {
    items: AttentionItem[];
    className?: string;
    onItemClick?: (item: AttentionItem) => void;
    onBatchDismiss?: (items: AttentionItem[]) => Promise<void>;
    onBatchSnooze?: (items: AttentionItem[], duration: number) => Promise<void>;
}

interface KanbanColumn {
    id: 'urgent' | 'today' | 'upcoming';
    title: string;
    emoji: string;
    icon: React.ReactNode;
    bgColor: string;
    headerColor: string;
    filter: (item: AttentionItem) => boolean;
}

const columns: KanbanColumn[] = [
    {
        id: 'urgent',
        title: 'URGENT',
        emoji: '',
        icon: <AlertCircle className="h-4 w-4" />,
        bgColor: 'bg-red-50 dark:bg-red-950/20',
        headerColor: 'text-red-600 dark:text-red-400',
        filter: (item) => item.priority === 'critical',
    },
    {
        id: 'today',
        title: 'TODAY',
        emoji: '',
        icon: <Clock className="h-4 w-4" />,
        bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
        headerColor: 'text-yellow-600 dark:text-yellow-400',
        filter: (item) => item.priority === 'important',
    },
    {
        id: 'upcoming',
        title: 'UPCOMING',
        emoji: '',
        icon: <Calendar className="h-4 w-4" />,
        bgColor: 'bg-green-50 dark:bg-green-950/20',
        headerColor: 'text-green-600 dark:text-green-400',
        filter: (item) => item.priority === 'info',
    },
];

import { useSwipeable } from 'react-swipeable';
import { useCallback } from 'react';
import { Check, Clock as ClockIcon, ArrowRight, Loader2, CheckCheck } from 'lucide-react';

interface KanbanCardProps {
    item: AttentionItem;
    onClick?: () => void;
    onDismiss?: (item: AttentionItem) => void;
    onSnooze?: (item: AttentionItem) => void;
}

function KanbanCard({
    item,
    onClick,
    onDismiss,
    onSnooze,
}: KanbanCardProps) {
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isActioned, setIsActioned] = useState(false);

    const handleDismiss = useCallback(() => {
        setIsActioned(true);
        setTimeout(() => onDismiss?.(item), 300);
    }, [item, onDismiss]);

    const handleSnooze = useCallback(() => {
        setIsActioned(true);
        setTimeout(() => onSnooze?.(item), 300);
    }, [item, onSnooze]);

    const handlers = useSwipeable({
        onSwiping: (e) => {
            // Limit swipe distance
            const offset = Math.max(-120, Math.min(120, e.deltaX));
            setSwipeOffset(offset);
        },
        onSwipedLeft: ({ velocity }) => {
            if (swipeOffset < -60 || velocity > 0.5) {
                setSwipeOffset(-120);
                handleDismiss();
            } else {
                setSwipeOffset(0);
            }
        },
        onSwipedRight: ({ velocity }) => {
            if (swipeOffset > 60 || velocity > 0.5) {
                setSwipeOffset(120);
                handleSnooze();
            } else {
                setSwipeOffset(0);
            }
        },
        onTouchEndOrOnMouseUp: () => {
            if (Math.abs(swipeOffset) < 60) {
                setSwipeOffset(0);
            }
        },
        trackMouse: false, // Disable mouse tracking for better desktop UX
        trackTouch: true,
        preventScrollOnSwipe: true,
    });

    // Calculate action visibility
    const showDismiss = swipeOffset < -30;
    const showSnooze = swipeOffset > 30;
    const dismissActive = swipeOffset < -60;
    const snoozeActive = swipeOffset > 60;

    if (isActioned) {
        return (
            <div className="h-16 rounded-lg overflow-hidden animate-out slide-out-to-left-full duration-300">
                <div className={cn(
                    'h-full flex items-center justify-center text-white font-medium',
                    dismissActive ? 'bg-green-500' : 'bg-blue-500'
                )}>
                    {dismissActive ? (
                        <><Check className="h-5 w-5 mr-2" /> Done</>
                    ) : (
                        <><ClockIcon className="h-5 w-5 mr-2" /> Snoozed</>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-lg">
            {/* Swipe Background Actions */}
            <div className="absolute inset-0 flex">
                {/* Snooze (right swipe) */}
                <div className={cn(
                    'flex-1 flex items-center justify-start pl-4 transition-colors',
                    snoozeActive ? 'bg-blue-500' : 'bg-blue-100 dark:bg-blue-900/40'
                )}>
                    <ClockIcon className={cn(
                        'h-5 w-5 transition-colors',
                        snoozeActive ? 'text-white' : 'text-blue-500'
                    )} />
                    <span className={cn(
                        'ml-2 text-sm font-medium transition-opacity',
                        showSnooze ? 'opacity-100' : 'opacity-0',
                        snoozeActive ? 'text-white' : 'text-blue-600'
                    )}>
                        Snooze
                    </span>
                </div>
                {/* Dismiss (left swipe) */}
                <div className={cn(
                    'flex-1 flex items-center justify-end pr-4 transition-colors',
                    dismissActive ? 'bg-green-500' : 'bg-green-100 dark:bg-green-900/40'
                )}>
                    <span className={cn(
                        'mr-2 text-sm font-medium transition-opacity',
                        showDismiss ? 'opacity-100' : 'opacity-0',
                        dismissActive ? 'text-white' : 'text-green-600'
                    )}>
                        Done
                    </span>
                    <Check className={cn(
                        'h-5 w-5 transition-colors',
                        dismissActive ? 'text-white' : 'text-green-500'
                    )} />
                </div>
            </div>

            {/* Card Content */}
            <div
                {...handlers}
                className={cn(
                    'bg-white dark:bg-card rounded-lg border p-3 shadow-sm relative',
                    'hover:shadow-md transition-all cursor-pointer',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'min-h-[44px] touch-manipulation',
                    item.priority === 'critical' && 'border-red-200 dark:border-red-800',
                    item.priority === 'important' && 'border-yellow-200 dark:border-yellow-800',
                    item.priority === 'info' && 'border-green-200 dark:border-green-800',
                )}
                style={{
                    transform: `translateX(${swipeOffset}px)`,
                    transition: swipeOffset === 0 ? 'transform 0.3s ease-out' : 'none',
                }}
                onClick={() => swipeOffset === 0 && onClick?.()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
            >
                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm line-clamp-2" title={item.title}>{item.title}</h4>
                        {item.value && (
                            <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground whitespace-nowrap">
                                <DollarSign className="h-3 w-3" />
                                {item.value}
                            </span>
                        )}
                    </div>

                    {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                        </p>
                    )}

                    <div className="flex items-center justify-between gap-2">
                        {item.category && (
                            <Badge
                                variant="outline"
                                className={cn("text-[10px] px-1.5 h-5", getCategoryColor(item.category))}
                            >
                                {item.category}
                            </Badge>
                        )}
                        <span className="text-xs text-primary flex items-center gap-0.5 ml-auto">
                            {item.actionLabel}
                            <ChevronRight className="h-3 w-3" />
                        </span>
                    </div>
                </div>

                {/* Mobile swipe hint */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] text-muted-foreground/50 md:hidden">
                    <ArrowRight className="h-2.5 w-2.5 rotate-180" />
                    <span>swipe</span>
                    <ArrowRight className="h-2.5 w-2.5" />
                </div>
            </div>
        </div>
    );
}

export function AttentionQueueKanban({
    items,
    className,
    onItemClick,
    onBatchDismiss,
    onBatchSnooze,
}: AttentionQueueKanbanProps) {
    const navigate = useNavigate();
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const [isProcessing, setIsProcessing] = useState<'dismiss' | 'snooze' | null>(null);
    const [selectedItem, setSelectedItem] = useState<AttentionItem | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    const columnItems = useMemo(() => {
        return columns.map(col => ({
            ...col,
            items: items.filter(col.filter),
        }));
    }, [items]);

    const handleItemClick = (item: AttentionItem) => {
        if (onItemClick) {
            onItemClick(item);
        } else {
            // Open sheet with item details instead of navigating
            setSelectedItem(item);
            setSheetOpen(true);
        }
    };

    const handleNavigateToItem = (item: AttentionItem) => {
        const url = item.actionUrl.startsWith('/')
            ? (tenantSlug ? `/${tenantSlug}${item.actionUrl}` : item.actionUrl)
            : item.actionUrl;
        setSheetOpen(false);
        navigate(url);
    };

    // Batch dismiss handler
    const handleBatchDismiss = async (columnId: string) => {
        if (!onBatchDismiss) return;
        const column = columnItems.find(c => c.id === columnId);
        if (!column || column.items.length === 0) return;

        setIsProcessing('dismiss');
        try {
            await onBatchDismiss(column.items);
        } finally {
            setIsProcessing(null);
        }
    };

    // Batch snooze handler (1 hour default)
    const handleBatchSnooze = async (columnId: string) => {
        if (!onBatchSnooze) return;
        const column = columnItems.find(c => c.id === columnId);
        if (!column || column.items.length === 0) return;

        setIsProcessing('snooze');
        try {
            await onBatchSnooze(column.items, 60 * 60 * 1000); // 1 hour
        } finally {
            setIsProcessing(null);
        }
    };

    const totalItems = items.length;

    if (totalItems === 0) {
        return (
            <Card className={className}>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="text-4xl mb-4"></div>
                    <h3 className="font-semibold text-lg">All Caught Up!</h3>
                    <p className="text-muted-foreground text-sm">
                        No items need your attention right now.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    NEEDS YOUR ATTENTION
                    <Badge variant="secondary" className="ml-2">
                        {totalItems}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {columnItems.map((column) => (
                        <div
                            key={column.id}
                            className={cn(
                                'rounded-lg p-3 min-h-[200px]',
                                column.bgColor,
                            )}
                        >
                            {/* Column Header */}
                            <div className={cn('flex items-center gap-2 mb-3', column.headerColor)}>
                                {column.icon}
                                <span className="font-semibold text-sm">{column.title}</span>
                                <Badge
                                    variant="secondary"
                                    className={cn('text-xs', column.headerColor)}
                                >
                                    {column.items.length}
                                </Badge>

                                {/* Batch Action Buttons */}
                                {column.items.length > 0 && (onBatchDismiss || onBatchSnooze) && (
                                    <div className="ml-auto flex items-center gap-1">
                                        {onBatchDismiss && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs gap-1"
                                                disabled={isProcessing !== null}
                                                onClick={() => handleBatchDismiss(column.id)}
                                                title={`Clear all ${column.items.length} items`}
                                            >
                                                {isProcessing === 'dismiss' ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <CheckCheck className="h-3 w-3" />
                                                )}
                                                <span className="hidden sm:inline">Clear All</span>
                                            </Button>
                                        )}
                                        {onBatchSnooze && column.id !== 'upcoming' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-xs gap-1"
                                                disabled={isProcessing !== null}
                                                onClick={() => handleBatchSnooze(column.id)}
                                                title="Snooze all for 1 hour"
                                            >
                                                {isProcessing === 'snooze' ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <ClockIcon className="h-3 w-3" />
                                                )}
                                                <span className="hidden sm:inline">Snooze</span>
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Column Items */}
                            <div className="space-y-2">
                                {column.items.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground text-sm">
                                        No items
                                    </div>
                                ) : (
                                    column.items.map((item) => (
                                        <KanbanCard
                                            key={item.id}
                                            item={item}
                                            onClick={() => handleItemClick(item)}
                                            onDismiss={onBatchDismiss ? () => onBatchDismiss([item]) : undefined}
                                            onSnooze={onBatchSnooze ? () => onBatchSnooze([item], 60 * 60 * 1000) : undefined}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>

            {/* Item Detail Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent>
                    {selectedItem && (
                        <>
                            <SheetHeader>
                                <SheetTitle className="flex items-center gap-2">
                                    {selectedItem.priority === 'critical' && (
                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                    )}
                                    {selectedItem.priority === 'important' && (
                                        <Clock className="h-5 w-5 text-yellow-500" />
                                    )}
                                    {selectedItem.priority === 'info' && (
                                        <Calendar className="h-5 w-5 text-green-500" />
                                    )}
                                    {selectedItem.title}
                                </SheetTitle>
                                <SheetDescription>
                                    {selectedItem.description || 'No additional details available.'}
                                </SheetDescription>
                            </SheetHeader>

                            <div className="py-6 space-y-4">
                                {/* Category */}
                                {selectedItem.category && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Category:</span>
                                        <Badge
                                            variant="outline"
                                            className={cn("text-xs", getCategoryColor(selectedItem.category))}
                                        >
                                            {selectedItem.category}
                                        </Badge>
                                    </div>
                                )}

                                {/* Value */}
                                {selectedItem.value && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Value:</span>
                                        <span className="font-medium flex items-center gap-1">
                                            <DollarSign className="h-4 w-4" />
                                            {selectedItem.value}
                                        </span>
                                    </div>
                                )}

                                {/* Priority */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Priority:</span>
                                    <Badge
                                        variant={
                                            selectedItem.priority === 'critical' ? 'destructive' :
                                            selectedItem.priority === 'important' ? 'default' : 'secondary'
                                        }
                                    >
                                        {selectedItem.priority === 'critical' ? 'Urgent' :
                                         selectedItem.priority === 'important' ? 'Today' : 'Upcoming'}
                                    </Badge>
                                </div>

                                {/* Action Label */}
                                {selectedItem.actionLabel && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Action:</span>
                                        <span className="text-sm">{selectedItem.actionLabel}</span>
                                    </div>
                                )}
                            </div>

                            <SheetFooter className="flex-col sm:flex-row gap-2">
                                {onBatchDismiss && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            onBatchDismiss([selectedItem]);
                                            setSheetOpen(false);
                                        }}
                                    >
                                        Mark as Done
                                    </Button>
                                )}
                                <Button onClick={() => handleNavigateToItem(selectedItem)}>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Go to Page
                                </Button>
                            </SheetFooter>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </Card>
    );
}
