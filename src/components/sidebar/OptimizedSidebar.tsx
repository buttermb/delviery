/**
 * Optimized Sidebar Component
 * 
 * Features:
 * - Task-based navigation (8 intuitive sections)
 * - Command palette search (Cmd+K)
 * - Progressive disclosure (show N, hide rest)
 * - Mobile responsive + dark mode
 * - Full keyboard navigation
 * - Accessibility compliant (WCAG AA)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { NavLink, useLocation, useParams, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
    ChevronDown,
    ChevronRight,
    Search,
    X,
    Command,
    Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useLiveBadge } from '@/components/admin/sidebar/LiveBadgeContext';
import { LiveCountBadge } from '@/components/admin/sidebar/LiveCountBadge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    getSidebarForTier,
    searchSidebarItems,
    OPTIMIZED_SIDEBAR_SECTIONS,
    type NavItem,
    type NavSection,
    type SubscriptionTier,
} from '@/lib/sidebar/optimizedSidebarConfig';
import { UpgradeModal } from '@/components/tenant-admin/UpgradeModal';
import { type FeatureId, TIER_NAMES as FEATURE_TIER_NAMES } from '@/lib/featureConfig';

interface OptimizedSidebarProps {
    userTier: SubscriptionTier;
    className?: string;
    collapsed?: boolean;
    onNavigate?: () => void;
    /** Show locked features with upgrade prompts */
    showLockedFeatures?: boolean;
    /** Maximum locked features to show per section */
    maxLockedPerSection?: number;
}

export function OptimizedSidebar({
    userTier,
    className,
    collapsed = false,
    onNavigate,
    showLockedFeatures = true,
    maxLockedPerSection = 2,
}: OptimizedSidebarProps) {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const searchInputRef = useRef<HTMLInputElement>(null);

    // State
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [showMoreSections, setShowMoreSections] = useState<Set<string>>(new Set());
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [upgradeFeatureId, setUpgradeFeatureId] = useState<FeatureId | null>(null);

    // Get live badge counts
    const liveBadgeContext = useLiveBadge();

    // Get sections filtered by tier
    const sections = useMemo(() => getSidebarForTier(userTier), [userTier]);

    // Get locked items per section for upgrade prompts
    const lockedItemsBySection = useMemo(() => {
        if (!showLockedFeatures) return {};

        const tierHierarchy: Record<SubscriptionTier, number> = {
            STARTER: 1,
            PROFESSIONAL: 2,
            ENTERPRISE: 3,
        };
        const userTierLevel = tierHierarchy[userTier];

        const result: Record<string, NavItem[]> = {};
        OPTIMIZED_SIDEBAR_SECTIONS.forEach(section => {
            const locked = section.items.filter(item =>
                tierHierarchy[item.tier] > userTierLevel
            ).slice(0, maxLockedPerSection);
            if (locked.length > 0) {
                result[section.id] = locked;
            }
        });
        return result;
    }, [userTier, showLockedFeatures, maxLockedPerSection]);

    // Initialize expanded sections
    useEffect(() => {
        const defaultExpanded = new Set<string>();
        sections.forEach(section => {
            if (section.defaultExpanded) {
                defaultExpanded.add(section.id);
            }
        });
        setExpandedSections(defaultExpanded);
    }, [sections]);

    // Search results
    const searchResults = useMemo(() => {
        return searchSidebarItems(searchQuery, userTier);
    }, [searchQuery, userTier]);

    // Keyboard shortcut for command palette
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
            if (e.key === 'Escape') {
                setSearchOpen(false);
                setSearchQuery('');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus search input when dialog opens
    useEffect(() => {
        if (searchOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [searchOpen]);

    // Build full path with tenant slug
    const getFullPath = useCallback((path: string) => {
        if (!tenantSlug) return path;
        return path.replace('/admin/', `/${tenantSlug}/admin/`);
    }, [tenantSlug]);

    // Check if path is active
    const isActive = useCallback((path: string) => {
        const fullPath = getFullPath(path);
        // Handle query params
        const [basePath] = fullPath.split('?');
        const [currentPath] = location.pathname.split('?');
        return currentPath.startsWith(basePath);
    }, [getFullPath, location.pathname]);

    // Toggle section expansion
    const toggleSection = useCallback((sectionId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    }, []);

    // Toggle show more items in section
    const toggleShowMore = useCallback((sectionId: string) => {
        setShowMoreSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
    }, []);

    // Handle navigation from search
    const handleSearchSelect = useCallback((item: NavItem) => {
        navigate(getFullPath(item.path));
        setSearchOpen(false);
        setSearchQuery('');
        onNavigate?.();
    }, [navigate, getFullPath, onNavigate]);

    // Map optimized tier to feature tier for modal
    const mapTierToFeatureTier = (tier: SubscriptionTier): 'starter' | 'professional' | 'enterprise' => {
        switch (tier) {
            case 'ENTERPRISE': return 'enterprise';
            case 'PROFESSIONAL': return 'professional';
            default: return 'starter';
        }
    };

    // Get tier display info
    const getTierBadgeInfo = (tier: SubscriptionTier) => {
        switch (tier) {
            case 'ENTERPRISE':
                return { label: 'Pro+', color: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/50' };
            case 'PROFESSIONAL':
                return { label: 'Pro', color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/50' };
            default:
                return { label: 'Start', color: 'text-green-600 dark:text-green-400', border: 'border-green-500/50' };
        }
    };

    // Render a single nav item
    const renderNavItem = (item: NavItem) => {
        const liveBadge = liveBadgeContext?.getBadge(item.path) ?? null;

        return (
            <NavLink
                key={item.id}
                to={getFullPath(item.path)}
                onClick={onNavigate}
                className={({ isActive: linkActive }) =>
                    cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                        'hover:bg-accent hover:text-accent-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        linkActive || isActive(item.path)
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground'
                    )
                }
            >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!collapsed && (
                    <>
                        <span className="flex-1 truncate">{item.name}</span>
                        {liveBadge ? (
                            <LiveCountBadge
                                count={liveBadge.count}
                                level={liveBadge.level}
                                pulse={liveBadge.pulse}
                            />
                        ) : item.badge ? (
                            <Badge variant="secondary" className="ml-auto text-xs">
                                {item.badge}
                            </Badge>
                        ) : item.hot ? (
                            <span className="ml-auto h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                        ) : item.shortcut ? (
                            <kbd className="ml-auto hidden lg:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-xs text-muted-foreground">
                                {item.shortcut}
                            </kbd>
                        ) : null}
                    </>
                )}
            </NavLink>
        );
    };

    // Render a locked nav item with upgrade tooltip
    const renderLockedNavItem = (item: NavItem) => {
        const tierInfo = getTierBadgeInfo(item.tier);

        return (
            <TooltipProvider key={`locked-${item.id}`} delayDuration={200}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setUpgradeFeatureId(item.id as FeatureId)}
                            className={cn(
                                'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all',
                                'opacity-60 hover:opacity-90 hover:bg-accent/50 cursor-pointer',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                            )}
                        >
                            <div className="relative flex-shrink-0">
                                <item.icon className="h-4 w-4 text-muted-foreground" />
                                <Lock className="absolute -bottom-1 -right-1 h-2.5 w-2.5 text-muted-foreground" />
                            </div>
                            {!collapsed && (
                                <>
                                    <span className="flex-1 truncate text-muted-foreground text-left">
                                        {item.name}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            'ml-auto flex items-center gap-1 text-[10px] px-1.5 py-0 h-5',
                                            tierInfo.border,
                                            tierInfo.color
                                        )}
                                    >
                                        <Lock className="h-2.5 w-2.5" />
                                        {tierInfo.label}
                                    </Badge>
                                </>
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px]">
                        <div className="space-y-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                                Requires {FEATURE_TIER_NAMES[mapTierToFeatureTier(item.tier)]} plan
                            </p>
                            <p className="text-xs text-primary font-medium">
                                Click to upgrade →
                            </p>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    // Render a section
    const renderSection = (section: NavSection) => {
        const isExpanded = expandedSections.has(section.id);
        const showMore = showMoreSections.has(section.id);
        const maxVisible = section.maxVisible || 4;
        const visibleItems = showMore ? section.items : section.items.slice(0, maxVisible);
        const hasMore = section.items.length > maxVisible;
        const lockedItems = lockedItemsBySection[section.id] || [];

        return (
            <Collapsible
                key={section.id}
                open={isExpanded}
                onOpenChange={() => toggleSection(section.id)}
                className="space-y-1"
            >
                <CollapsibleTrigger asChild>
                    <Button
                        variant="ghost"
                        className={cn(
                            'w-full justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider',
                            'text-muted-foreground hover:text-foreground',
                            collapsed && 'justify-center'
                        )}
                    >
                        {!collapsed && (
                            <span className="flex items-center gap-2">
                                {section.name}
                                {lockedItems.length > 0 && (
                                    <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] px-1 py-0 h-4 opacity-50"
                                                >
                                                    <Lock className="h-2 w-2 mr-0.5" />
                                                    +{lockedItems.length}
                                                </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <span className="text-xs">
                                                    {lockedItems.length} feature{lockedItems.length !== 1 ? 's' : ''} available with upgrade
                                                </span>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </span>
                        )}
                        {!collapsed && (
                            isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )
                        )}
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1">
                    {visibleItems.map(renderNavItem)}
                    {/* Locked items with upgrade tooltip */}
                    {showLockedFeatures && lockedItems.map(renderLockedNavItem)}
                    {hasMore && !collapsed && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleShowMore(section.id);
                            }}
                            className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                        >
                            {showMore ? '← Show less' : `+ ${section.items.length - maxVisible} more`}
                        </button>
                    )}
                </CollapsibleContent>
            </Collapsible>
        );
    };

    return (
        <>
            <nav
                className={cn(
                    'flex flex-col h-full bg-background border-r',
                    collapsed ? 'w-16' : 'w-64',
                    className
                )}
                aria-label="Main navigation"
            >
                {/* Search trigger */}
                {!collapsed && (
                    <div className="p-3 border-b">
                        <Button
                            variant="outline"
                            className="w-full justify-start text-muted-foreground"
                            onClick={() => setSearchOpen(true)}
                        >
                            <Search className="h-4 w-4 mr-2" />
                            <span className="flex-1 text-left">Search...</span>
                            <kbd className="ml-auto hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-xs">
                                <Command className="h-3 w-3" />K
                            </kbd>
                        </Button>
                    </div>
                )}

                {/* Sections */}
                <ScrollArea className="flex-1 px-2 py-3">
                    <div className="space-y-4">
                        {sections.map(renderSection)}
                    </div>
                </ScrollArea>
            </nav>

            {/* Upgrade Modal */}
            {upgradeFeatureId && (
                <UpgradeModal
                    open={!!upgradeFeatureId}
                    onOpenChange={(open) => !open && setUpgradeFeatureId(null)}
                    featureId={upgradeFeatureId}
                />
            )}

            {/* Command Palette / Search Dialog */}
            <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
                <DialogContent className="sm:max-w-md p-0">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Search Navigation</DialogTitle>
                    </DialogHeader>
                    <div className="border-b p-3">
                        <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <Input
                                ref={searchInputRef}
                                placeholder="Search features..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="border-0 focus-visible:ring-0 h-8 p-0"
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setSearchQuery('')}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <ScrollArea className="max-h-80">
                        {searchQuery ? (
                            searchResults.length > 0 ? (
                                <div className="p-2 space-y-1">
                                    {searchResults.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSearchSelect(item)}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left hover:bg-accent transition-colors"
                                        >
                                            <item.icon className="h-4 w-4 text-muted-foreground" />
                                            <span>{item.name}</span>
                                            {item.shortcut && (
                                                <kbd className="ml-auto text-xs text-muted-foreground">
                                                    {item.shortcut}
                                                </kbd>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    No results found for "{searchQuery}"
                                </div>
                            )
                        ) : (
                            <div className="p-4 text-center text-muted-foreground text-sm">
                                Start typing to search...
                            </div>
                        )}
                    </ScrollArea>
                    <div className="border-t p-2 text-xs text-muted-foreground flex items-center justify-center gap-4">
                        <span>↑↓ Navigate</span>
                        <span>↵ Select</span>
                        <span>Esc Close</span>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default OptimizedSidebar;
