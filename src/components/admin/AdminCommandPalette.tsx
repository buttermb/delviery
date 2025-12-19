/**
 * Admin Command Palette Component
 * ⌘K quick search and command interface for tenant admin panel
 */

import { useState, useEffect, useMemo } from 'react';
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
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    Truck,
    FileText,
    Settings,
    Plus,
    Search,
    Menu,
    DollarSign,
    BarChart3,
    MessageSquare,
    Clock,
    Flame,
    Store,
    CreditCard,
    Bell,
    Map,
} from 'lucide-react';

interface AdminCommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
    const navigate = useTenantNavigate();
    const { tenant } = useTenantAdminAuth();
    const [search, setSearch] = useState('');

    // Reset search when dialog closes
    useEffect(() => {
        if (!open) {
            setSearch('');
        }
    }, [open]);

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

        const navigation = [
            {
                id: 'dashboard',
                label: 'Dashboard',
                icon: LayoutDashboard,
                action: () => navigate('/dashboard'),
                keywords: ['home', 'overview', 'main'],
            },
            {
                id: 'hotbox',
                label: 'Hotbox',
                icon: Flame,
                action: () => navigate('/hotbox'),
                keywords: ['attention', 'urgent', 'tasks', 'todo'],
            },
            {
                id: 'orders',
                label: 'Orders',
                icon: ShoppingCart,
                action: () => navigate('/orders'),
                keywords: ['orders', 'sales', 'transactions'],
            },
            {
                id: 'menus',
                label: 'Disposable Menus',
                icon: Menu,
                action: () => navigate('/menus'),
                keywords: ['menu', 'disposable', 'share'],
            },
            {
                id: 'products',
                label: 'Products',
                icon: Package,
                action: () => navigate('/products'),
                keywords: ['inventory', 'stock', 'items'],
            },
            {
                id: 'customers',
                label: 'Customers',
                icon: Users,
                action: () => navigate('/customers'),
                keywords: ['clients', 'contacts', 'buyers'],
            },
            {
                id: 'deliveries',
                label: 'Deliveries',
                icon: Truck,
                action: () => navigate('/deliveries'),
                keywords: ['delivery', 'fleet', 'courier'],
            },
            {
                id: 'live-map',
                label: 'Live Map',
                icon: Map,
                action: () => navigate('/live-map'),
                keywords: ['map', 'tracking', 'location'],
            },
            {
                id: 'who-owes-me',
                label: 'Who Owes Me',
                icon: DollarSign,
                action: () => navigate('/collection-mode'),
                keywords: ['tabs', 'debt', 'balance', 'owed', 'collection'],
            },
            {
                id: 'reports',
                label: 'Reports',
                icon: BarChart3,
                action: () => navigate('/reports'),
                keywords: ['analytics', 'metrics', 'stats'],
            },
            {
                id: 'live-chat',
                label: 'Live Chat',
                icon: MessageSquare,
                action: () => navigate('/live-chat'),
                keywords: ['chat', 'messages', 'support'],
            },
            {
                id: 'activity',
                label: 'Activity Logs',
                icon: Clock,
                action: () => navigate('/activity'),
                keywords: ['logs', 'history', 'audit'],
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

        return { quickActions, navigation };
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
    const filteredNavigation = filterCommands(commands.navigation, search);

    const handleSelect = (action: () => void) => {
        action();
        onOpenChange(false);
    };

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange}>
            <CommandInput
                placeholder="Type a command or search..."
                value={search}
                onValueChange={setSearch}
            />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

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
                                            <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {filteredNavigation.length > 0 && (
                    <CommandGroup heading="Navigation">
                        {filteredNavigation.map((cmd) => {
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
                                        <CommandShortcut>{cmd.shortcut}</CommandShortcut>
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
