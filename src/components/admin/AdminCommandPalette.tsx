/**
 * Admin Command Palette Component
 * ⌘K quick search and command interface for tenant admin panel
 * Enhanced with global data search across customers, orders, products
 * Includes recent searches tracking
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { logger } from '@/lib/logger';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useDataSearch, SearchResult } from '@/hooks/useDataSearch';
import { sanitizeSearchInput } from '@/lib/utils/searchSanitize';
import { Loader2, X, History } from 'lucide-react';
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    Truck,
    Settings,
    Plus,
    Menu,
    DollarSign,
    BarChart3,
    Clock,
    Flame,
    CreditCard,
    Bell,
    Map,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STORAGE_KEYS } from '@/constants/storageKeys';
const MAX_RECENT_SEARCHES = 5;

interface RecentSearch {
    id: string;
    type: string;
    label: string;
    sublabel?: string;
    url: string;
    icon: string;
    timestamp: number;
}

interface AdminCommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
    const navigate = useTenantNavigate();
    useTenantAdminAuth();
    const [search, setSearch] = useState('');
    const { results: dataResults, isSearching, search: searchData, clearResults } = useDataSearch();
    const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

    // Load recent searches from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.ADMIN_RECENT_SEARCHES);
            if (saved) {
                setRecentSearches(JSON.parse(saved));
            }
        } catch (e) {
            logger.error('Failed to load recent searches', e);
        }
    }, []);

    // Save recent search when selecting a data result
    const saveRecentSearch = useCallback((result: SearchResult) => {
        const newRecent: RecentSearch = {
            id: result.id,
            type: result.type,
            label: result.label,
            sublabel: result.sublabel,
            url: result.url,
            icon: result.icon,
            timestamp: Date.now(),
        };

        setRecentSearches((prev) => {
            const filtered = prev.filter((r) => !(r.id === result.id && r.type === result.type));
            const updated = [newRecent, ...filtered].slice(0, MAX_RECENT_SEARCHES);
            localStorage.setItem(STORAGE_KEYS.ADMIN_RECENT_SEARCHES, JSON.stringify(updated));
            return updated;
        });
    }, []);

    // Clear all recent searches
    const clearRecentSearches = useCallback(() => {
        setRecentSearches([]);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_RECENT_SEARCHES);
    }, []);

    // Reset search when dialog closes
    useEffect(() => {
        if (!open) {
            setSearch('');
            clearResults();
        }
    }, [open, clearResults]);

    // Debounced data search
    useEffect(() => {
        const timer = setTimeout(() => {
            const sanitized = sanitizeSearchInput(search);
            if (sanitized.length >= 2) {
                searchData(sanitized);
            } else {
                clearResults();
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [search, searchData, clearResults]);

    const commands = useMemo(() => {
        const quickActions = [
            {
                id: 'new-order',
                label: 'New Order',
                icon: Plus,
                action: () => navigate('/orders/new'),
                shortcut: '⌘O',
                keywords: ['order', 'create', 'add', 'sale'],
            },
            {
                id: 'new-menu',
                label: 'Create Menu',
                icon: Menu,
                action: () => navigate('/menus/create'),
                shortcut: '⌘M',
                keywords: ['menu', 'disposable', 'create', 'new'],
            },
            {
                id: 'new-customer',
                label: 'Add Customer',
                icon: Users,
                action: () => navigate('/customers?action=new'),
                shortcut: '⌘C',
                keywords: ['customer', 'client', 'new', 'add'],
            },
            {
                id: 'new-product',
                label: 'Add Product',
                icon: Package,
                action: () => navigate('/products?action=new'),
                shortcut: '⌘P',
                keywords: ['product', 'inventory', 'new', 'add'],
            },
            {
                id: 'pos',
                label: 'Open POS Register',
                icon: CreditCard,
                action: () => navigate('/pos'),
                shortcut: '⌘R',
                keywords: ['pos', 'register', 'sale', 'cash'],
            },
        ];

        // Hub-aligned navigation
        const hubs = [
            {
                id: 'home',
                label: 'Home Dashboard',
                icon: LayoutDashboard,
                action: () => navigate('/dashboard'),
                shortcut: '⌘1',
                keywords: ['home', 'overview', 'main', 'dashboard'],
            },
            {
                id: 'orders-hub',
                label: 'Orders Hub',
                icon: ShoppingCart,
                action: () => navigate('/orders'),
                shortcut: '⌘2',
                keywords: ['orders', 'sales', 'transactions'],
            },
            {
                id: 'inventory-hub',
                label: 'Inventory Hub',
                icon: Package,
                action: () => navigate('/inventory-hub'),
                shortcut: '⌘3',
                keywords: ['inventory', 'stock', 'products', 'items'],
            },
            {
                id: 'customer-hub',
                label: 'Customers Hub',
                icon: Users,
                action: () => navigate('/customer-hub'),
                shortcut: '⌘4',
                keywords: ['customers', 'clients', 'contacts', 'crm'],
            },
            {
                id: 'finance-hub',
                label: 'Finance Hub',
                icon: DollarSign,
                action: () => navigate('/finance-hub'),
                shortcut: '⌘5',
                keywords: ['finance', 'revenue', 'payments', 'money'],
            },
            {
                id: 'fulfillment-hub',
                label: 'Fulfillment Hub',
                icon: Truck,
                action: () => navigate('/fulfillment-hub'),
                shortcut: '⌘6',
                keywords: ['fulfillment', 'shipping', 'delivery', 'courier'],
            },
            {
                id: 'marketing-hub',
                label: 'Marketing Hub',
                icon: Bell,
                action: () => navigate('/marketing-hub'),
                shortcut: '⌘7',
                keywords: ['marketing', 'promotions', 'campaigns', 'loyalty'],
            },
            {
                id: 'analytics-hub',
                label: 'Analytics Hub',
                icon: BarChart3,
                action: () => navigate('/analytics-hub'),
                shortcut: '⌘8',
                keywords: ['analytics', 'reports', 'metrics', 'stats'],
            },
        ];

        const quickAccess = [
            {
                id: 'hotbox',
                label: 'Hotbox (Priority Tasks)',
                icon: Flame,
                action: () => navigate('/hotbox'),
                keywords: ['attention', 'urgent', 'tasks', 'todo', 'priority'],
            },
            {
                id: 'live-map',
                label: 'Live Map',
                icon: Map,
                action: () => navigate('/live-map'),
                keywords: ['map', 'tracking', 'location', 'drivers'],
            },
            {
                id: 'live-orders',
                label: 'Live Orders',
                icon: Clock,
                action: () => navigate('/live-orders'),
                keywords: ['live', 'realtime', 'orders', 'tracking'],
            },
            {
                id: 'who-owes-me',
                label: 'Who Owes Me',
                icon: DollarSign,
                action: () => navigate('/collection-mode'),
                keywords: ['tabs', 'debt', 'balance', 'owed', 'collection'],
            },
            {
                id: 'menus',
                label: 'Disposable Menus',
                icon: Menu,
                action: () => navigate('/menus'),
                keywords: ['menu', 'disposable', 'share'],
            },
            {
                id: 'settings',
                label: 'Settings',
                icon: Settings,
                action: () => navigate('/settings'),
                shortcut: '⌘,',
                keywords: ['settings', 'preferences', 'config'],
            },
        ];

        return { quickActions, hubs, quickAccess };
    }, [navigate]);

    const filterCommands = <T extends { label: string; keywords?: string[] }>(
        cmds: T[],
        query: string
    ): T[] => {
        if (!query) return cmds;
        const lowerQuery = query.toLowerCase();
        return cmds.filter(
            (cmd) =>
                cmd.label.toLowerCase().includes(lowerQuery) ||
                cmd.keywords?.some((kw) => kw.toLowerCase().includes(lowerQuery))
        );
    };

    const filteredActions = filterCommands(commands.quickActions, search);
    const filteredHubs = filterCommands(commands.hubs, search);
    const filteredQuickAccess = filterCommands(commands.quickAccess, search);

    const handleSelect = (action: () => void) => {
        action();
        onOpenChange(false);
    };

    const handleDataResultSelect = (result: SearchResult) => {
        saveRecentSearch(result);
        navigate(result.url);
        onOpenChange(false);
    };

    const handleRecentSelect = (recent: RecentSearch) => {
        navigate(recent.url);
        onOpenChange(false);
    };

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput
                placeholder="Search customers, orders, products or type a command..."
                value={search}
                onValueChange={setSearch}
            />
            <CommandList>
                <CommandEmpty>
                    {isSearching ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Searching...
                        </div>
                    ) : (
                        'No results found.'
                    )}
                </CommandEmpty>

                {/* Recent Searches - show when no search query */}
                {!search && recentSearches.length > 0 && (
                    <>
                        <CommandGroup heading={
                            <div className="flex items-center justify-between w-full">
                                <span>Recent Searches</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearRecentSearches();
                                    }}
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    Clear
                                </Button>
                            </div>
                        }>
                            {recentSearches.map((recent) => (
                                <CommandItem
                                    key={`recent-${recent.type}-${recent.id}`}
                                    onSelect={() => handleRecentSelect(recent)}
                                    className="min-h-[44px]"
                                >
                                    <History className="mr-2 h-4 w-4 text-muted-foreground" />
                                    <span className="mr-2">{recent.icon}</span>
                                    <div className="flex flex-col">
                                        <span>{recent.label}</span>
                                        {recent.sublabel && (
                                            <span className="text-xs text-muted-foreground">{recent.sublabel}</span>
                                        )}
                                    </div>
                                    <span className="ml-auto text-xs text-muted-foreground capitalize">
                                        {recent.type}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {/* Data Search Results */}
                {dataResults.length > 0 && (
                    <>
                        <CommandGroup heading="Search Results">
                            {dataResults.map((result) => (
                                <CommandItem
                                    key={`${result.type}-${result.id}`}
                                    onSelect={() => handleDataResultSelect(result)}
                                    className="min-h-[44px]"
                                >
                                    <span className="mr-2">{result.icon}</span>
                                    <div className="flex flex-col">
                                        <span>{result.label}</span>
                                        {result.sublabel && (
                                            <span className="text-xs text-muted-foreground">{result.sublabel}</span>
                                        )}
                                    </div>
                                    <span className="ml-auto text-xs text-muted-foreground capitalize">
                                        {result.type}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {filteredActions.length > 0 && (
                    <>
                        <CommandGroup heading="Quick Actions">
                            {filteredActions.map((cmd) => {
                                const Icon = cmd.icon;
                                return (
                                    <CommandItem
                                        key={cmd.id}
                                        onSelect={() => handleSelect(cmd.action)}
                                        className="min-h-[44px]"
                                    >
                                        <Icon className="mr-2 h-4 w-4" />
                                        <span>{cmd.label}</span>
                                        {cmd.shortcut && (
                                            <CommandShortcut className="hidden sm:inline">{cmd.shortcut}</CommandShortcut>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {filteredHubs.length > 0 && (
                    <>
                        <CommandGroup heading="Hubs">
                            {filteredHubs.map((cmd) => {
                                const Icon = cmd.icon;
                                return (
                                    <CommandItem
                                        key={cmd.id}
                                        onSelect={() => handleSelect(cmd.action)}
                                        className="min-h-[44px]"
                                    >
                                        <Icon className="mr-2 h-4 w-4" />
                                        <span>{cmd.label}</span>
                                        {cmd.shortcut && (
                                            <CommandShortcut className="hidden sm:inline">{cmd.shortcut}</CommandShortcut>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {filteredQuickAccess.length > 0 && (
                    <CommandGroup heading="Quick Access">
                        {filteredQuickAccess.map((cmd) => {
                            const Icon = cmd.icon;
                            return (
                                <CommandItem
                                    key={cmd.id}
                                    onSelect={() => handleSelect(cmd.action)}
                                    className="min-h-[44px]"
                                >
                                    <Icon className="mr-2 h-4 w-4" />
                                    <span>{cmd.label}</span>
                                    {cmd.shortcut && (
                                        <CommandShortcut className="hidden sm:inline">{cmd.shortcut}</CommandShortcut>
                                    )}
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>
                )}
            </CommandList>
        </CommandDialog>
    );
}
