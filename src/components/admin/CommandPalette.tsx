/**
 * ⌘K Command Palette - Quick Navigation & Actions
 * Modern command palette for fast access to all features
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { 
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Package, Menu, Plus, Users, DollarSign, 
  Truck, FileText, Settings, BarChart3, Lock, Image,
  ArrowRight, Sparkles, Shield, Bell, Printer, Tag, Warehouse
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  action?: () => void;
  shortcut?: string;
  keywords?: string[];
  category: string;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Search actual data (customers, orders, products) when search term is 2+ chars
  const { data: searchResults } = useQuery({
    queryKey: ['command-search', search, account?.id],
    queryFn: async () => {
      if (!search || search.length < 2 || !account?.id) return null;

      const searchLower = search.toLowerCase();

      // Search customers, orders, and products in parallel
      const [customersResult, ordersResult, productsResult] = await Promise.all([
        supabase
          .from('wholesale_clients')
          .select('id, business_name, contact_name, phone, email')
          .or(`business_name.ilike.%${searchLower}%,contact_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%,email.ilike.%${searchLower}%`)
          .eq('account_id', account.id)
          .limit(5)
          .catch(() => ({ data: null, error: null })),
        
        supabase
          .from('wholesale_orders')
          .select('id, order_number, total_amount, status, created_at')
          .or(`order_number.ilike.%${searchLower}%,customer_name.ilike.%${searchLower}%`)
          .eq('account_id', account.id)
          .limit(5)
          .catch(() => ({ data: null, error: null })),
        
        supabase
          .from('wholesale_inventory')
          .select('id, strain, category, weight_lbs, price_per_lb')
          .or(`strain.ilike.%${searchLower}%,category.ilike.%${searchLower}%`)
          .eq('account_id', account.id)
          .limit(5)
          .catch(() => ({ data: null, error: null })),
      ]);

      return {
        customers: customersResult.data || [],
        orders: ordersResult.data || [],
        products: productsResult.data || [],
      };
    },
    enabled: search.length >= 2 && !!account?.id,
  });

  // Command items organized by category
  const commands: CommandItem[] = [
    // Quick Actions
    {
      id: 'new-order',
      label: 'New Order',
      icon: <Package className="h-4 w-4" />,
      href: '/admin/big-plug-order',
      shortcut: '⌘N',
      keywords: ['order', 'new', 'create'],
      category: 'Quick Actions',
    },
    {
      id: 'create-menu',
      label: 'Create Menu',
      icon: <Menu className="h-4 w-4" />,
      href: '/admin/disposable-menus?action=create',
      shortcut: '⌘M',
      keywords: ['menu', 'new', 'create'],
      category: 'Quick Actions',
    },
    {
      id: 'add-product',
      label: 'Add Product',
      icon: <Plus className="h-4 w-4" />,
      href: '/admin/wholesale-inventory-manage?action=new',
      shortcut: '⌘P',
      keywords: ['product', 'add', 'new'],
      category: 'Quick Actions',
    },
    {
      id: 'new-transfer',
      label: 'Create Transfer',
      icon: <Truck className="h-4 w-4" />,
      href: '/admin/inventory/dispatch',
      shortcut: '⌘T',
      keywords: ['transfer', 'move', 'dispatch'],
      category: 'Quick Actions',
    },
    {
      id: 'new-client',
      label: 'Add Client',
      icon: <Users className="h-4 w-4" />,
      href: '/admin/wholesale-clients?action=new',
      keywords: ['client', 'customer', 'add'],
      category: 'Quick Actions',
    },

    // Navigation - Dashboard
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      icon: <Sparkles className="h-4 w-4" />,
      href: '/admin/big-plug-dashboard',
      keywords: ['dashboard', 'home', 'overview'],
      category: 'Navigation',
    },
    {
      id: 'nav-wholesale-dashboard',
      label: 'Wholesale Dashboard',
      icon: <BarChart3 className="h-4 w-4" />,
      href: '/admin/wholesale-dashboard',
      keywords: ['wholesale', 'dashboard'],
      category: 'Navigation',
    },

    // Navigation - Operations
    {
      id: 'nav-orders',
      label: 'Orders',
      icon: <FileText className="h-4 w-4" />,
      href: '/admin/wholesale-clients/new-order',
      keywords: ['orders', 'order', 'list'],
      category: 'Navigation',
    },
    {
      id: 'nav-inventory',
      label: 'Inventory',
      icon: <Package className="h-4 w-4" />,
      href: '/admin/big-plug-inventory',
      keywords: ['inventory', 'stock', 'products'],
      category: 'Navigation',
    },
    {
      id: 'nav-receiving',
      label: 'Receiving & Packaging',
      icon: <Warehouse className="h-4 w-4" />,
      href: '/admin/operations/receiving',
      keywords: ['receiving', 'packaging', 'warehouse'],
      category: 'Navigation',
    },
    {
      id: 'nav-catalog-images',
      label: 'Product Images',
      icon: <Image className="h-4 w-4" />,
      href: '/admin/catalog/images',
      keywords: ['images', 'media', 'photos', 'pictures'],
      category: 'Navigation',
    },
    {
      id: 'nav-catalog-batches',
      label: 'Batches & Lots',
      icon: <Tag className="h-4 w-4" />,
      href: '/admin/catalog/batches',
      keywords: ['batches', 'lots', 'inventory batches'],
      category: 'Navigation',
    },
    {
      id: 'nav-pricing',
      label: 'Pricing & Deals',
      icon: <DollarSign className="h-4 w-4" />,
      href: '/admin/sales/pricing',
      keywords: ['pricing', 'deals', 'discounts', 'bulk'],
      category: 'Navigation',
    },
    {
      id: 'nav-warehouses',
      label: 'Warehouses',
      icon: <Warehouse className="h-4 w-4" />,
      href: '/admin/locations/warehouses',
      keywords: ['warehouses', 'locations', 'storage'],
      category: 'Navigation',
    },
    {
      id: 'nav-runners',
      label: 'Runners & Vehicles',
      icon: <Truck className="h-4 w-4" />,
      href: '/admin/locations/runners',
      keywords: ['runners', 'drivers', 'vehicles', 'delivery'],
      category: 'Navigation',
    },
    {
      id: 'nav-fleet',
      label: 'Fleet Management',
      icon: <Truck className="h-4 w-4" />,
      href: '/admin/fleet-management',
      keywords: ['fleet', 'runners', 'deliveries'],
      category: 'Navigation',
    },
    {
      id: 'nav-transfers',
      label: 'Transfers',
      icon: <Truck className="h-4 w-4" />,
      href: '/admin/inventory/dispatch',
      keywords: ['transfer', 'dispatch', 'move'],
      category: 'Navigation',
    },

    // Navigation - Sales
    {
      id: 'nav-menus',
      label: 'Disposable Menus',
      icon: <Lock className="h-4 w-4" />,
      href: '/admin/disposable-menus',
      keywords: ['menu', 'menus', 'disposable'],
      category: 'Navigation',
    },
    {
      id: 'nav-clients',
      label: 'Clients',
      icon: <Users className="h-4 w-4" />,
      href: '/admin/big-plug-clients',
      keywords: ['clients', 'customers', 'b2b'],
      category: 'Navigation',
    },
    {
      id: 'nav-analytics',
      label: 'Analytics',
      icon: <BarChart3 className="h-4 w-4" />,
      href: '/admin/analytics/comprehensive',
      keywords: ['analytics', 'reports', 'stats'],
      category: 'Navigation',
    },

    // Navigation - Finance
    {
      id: 'nav-financial',
      label: 'Financial Center',
      icon: <DollarSign className="h-4 w-4" />,
      href: '/admin/big-plug-financial',
      keywords: ['financial', 'money', 'credit', 'payments'],
      category: 'Navigation',
    },

    // Settings
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      href: '/admin/settings',
      keywords: ['settings', 'config', 'preferences'],
      category: 'Settings',
    },
    {
      id: 'security',
      label: 'Security Settings',
      icon: <Shield className="h-4 w-4" />,
      href: '/admin/settings?tab=security',
      keywords: ['security', '2fa', 'password'],
      category: 'Settings',
    },
    {
      id: 'notifications',
      label: 'Notification Settings',
      icon: <Bell className="h-4 w-4" />,
      href: '/admin/settings?tab=notifications',
      keywords: ['notifications', 'alerts', 'emails'],
      category: 'Settings',
    },
    {
      id: 'printing',
      label: 'Printing & Labels',
      icon: <Printer className="h-4 w-4" />,
      href: '/admin/settings?tab=printing',
      keywords: ['printing', 'labels', 'barcode'],
      category: 'Settings',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <BarChart3 className="h-4 w-4" />,
      href: '/admin/reports',
      keywords: ['reports', 'analytics', 'export'],
      category: 'Settings',
    },
  ];

  // Filter navigation commands based on search
  const filteredCommands = search && search.length < 2
    ? commands.filter(cmd => {
        const searchLower = search.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(searchLower) ||
          cmd.keywords?.some(k => k.toLowerCase().includes(searchLower)) ||
          cmd.category.toLowerCase().includes(searchLower)
        );
      })
    : search && search.length >= 2
    ? [] // Hide navigation commands when searching data
    : commands; // Show all when no search

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Keyboard shortcut to open (Cmd+K / Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (cmd: CommandItem) => {
    if (cmd.href) {
      navigate(cmd.href);
    }
    if (cmd.action) {
      cmd.action();
    }
    setOpen(false);
    setSearch('');
  };

  // Combine navigation commands and search results for display
  const hasSearchResults = searchResults && (
    searchResults.customers.length > 0 ||
    searchResults.orders.length > 0 ||
    searchResults.products.length > 0
  );

  return (
    <>
      {/* Keyboard shortcut hint */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search or type a command...</span>
        <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search customers, orders, products, or type a command..." 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Search Results (customers, orders, products) */}
          {hasSearchResults && (
            <>
              {searchResults.customers.length > 0 && (
                <CommandGroup heading="Customers">
                  {searchResults.customers.map((customer: any) => (
                    <CommandItem
                      key={`customer-${customer.id}`}
                      onSelect={() => {
                        navigate(`/admin/wholesale-clients/${customer.id}`);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{customer.business_name || customer.contact_name}</div>
                        {customer.phone && (
                          <div className="text-xs text-muted-foreground">{customer.phone}</div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchResults.orders.length > 0 && (
                <CommandGroup heading="Orders">
                  {searchResults.orders.map((order: any) => (
                    <CommandItem
                      key={`order-${order.id}`}
                      onSelect={() => {
                        navigate(`/admin/wholesale-orders/${order.id}`);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">#{order.order_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(Number(order.total_amount || 0))} • {order.status}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchResults.products.length > 0 && (
                <CommandGroup heading="Products">
                  {searchResults.products.map((product: any) => (
                    <CommandItem
                      key={`product-${product.id}`}
                      onSelect={() => {
                        navigate(`/admin/wholesale-inventory-manage?id=${product.id}`);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{product.strain || 'Product'}</div>
                        <div className="text-xs text-muted-foreground">
                          {product.category} • {product.weight_lbs} lbs
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}

          {/* Navigation Commands (when not searching data or search < 2 chars) */}
          {filteredCommands.length > 0 && Object.keys(groupedCommands).length > 0 && (
            Object.entries(groupedCommands).map(([category, items]) => (
              <CommandGroup key={category} heading={category}>
                {items.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => handleSelect(cmd)}
                  >
                    <div className="mr-2">{cmd.icon}</div>
                    <span>{cmd.label}</span>
                    {cmd.shortcut && (
                      <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

