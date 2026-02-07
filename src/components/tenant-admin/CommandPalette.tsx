/**
 * Tenant Admin Command Palette Component
 * ⌘K quick search and command interface
 * 
 * Features:
 * - Real-time search of products, clients, orders
 * - Quick navigation to any page
 * - Recent items history
 * - Action shortcuts
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
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
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  Settings,
  Search,
  Plus,
  DollarSign,
  TrendingUp,
  Boxes,
  Truck,
  MapPin,
  BarChart3,
  Calculator,
  Wallet,
  Clock,
  ArrowRight,
  Menu,
  Clipboard,
  Bell,
  Zap,
  HelpCircle,
  Tag,
  Layers,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { STORAGE_KEYS } from '@/constants/storageKeys';

// Recent items storage key
const RECENT_ITEMS_KEY = 'commandPalette_recentItems';

// Global state for command palette visibility
interface CommandPaletteState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((state) => ({ open: !state.open })),
}));

interface RecentItem {
  id: string;
  type: 'page' | 'order' | 'client' | 'product';
  title: string;
  href: string;
  timestamp: number;
}

interface NavigationPage {
  id: string;
  title: string;
  icon: React.ElementType;
  href: string;
  shortcut?: string;
  keywords?: string[];
}

interface QuickAction {
  id: string;
  title: string;
  icon: React.ElementType;
  href: string;
  keywords?: string[];
}

export function TenantAdminCommandPalette() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();

  // Use global state
  const { open, setOpen, toggle } = useCommandPaletteStore();
  const [search, setSearch] = useState('');

  // Recent items from localStorage
  const [recentItems, setRecentItems] = useState<RecentItem[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_ITEMS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save recent item
  const saveRecentItem = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
    setRecentItems((prev) => {
      const filtered = prev.filter((i) => i.id !== item.id);
      const updated = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors (e.g., incognito mode)
      }
      return updated;
    });
  }, []);

  // Keyboard shortcut handler
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Build tenant-aware URL
  const buildUrl = useCallback((path: string) => {
    if (!tenantSlug) return path;
    return `/${tenantSlug}/admin/${path}`;
  }, [tenantSlug]);

  // Search products query
  const { data: products } = useQuery({
    queryKey: ['commandPalette', 'products', search, tenant?.id],
    queryFn: async () => {
      if (!search || !tenant?.id || search.length < 2) return [];
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, category')
        .eq('tenant_id', tenant.id)
        .ilike('name', `%${search}%`)
        .limit(5);
      return data || [];
    },
    enabled: search.length >= 2 && !!tenant?.id,
    staleTime: 30000,
  });

  // Search clients query
  const { data: clients } = useQuery({
    queryKey: ['commandPalette', 'clients', search, tenant?.id],
    queryFn: async () => {
      if (!search || !tenant?.id || search.length < 2) return [];
      const { data } = await supabase
        .from('wholesale_clients')
        .select('id, business_name, contact_name')
        .eq('tenant_id', tenant.id)
        .or(`business_name.ilike.%${search}%,contact_name.ilike.%${search}%`)
        .limit(5);
      return data || [];
    },
    enabled: search.length >= 2 && !!tenant?.id,
    staleTime: 30000,
  });

  // Search orders query
  const { data: orders } = useQuery({
    queryKey: ['commandPalette', 'orders', search, tenant?.id],
    queryFn: async () => {
      if (!search || !tenant?.id || search.length < 2) return [];
      const { data } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: search.length >= 2 && !!tenant?.id,
    staleTime: 30000,
  });

  // Navigation pages
  const navigationPages: NavigationPage[] = useMemo(() => [
    { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, href: buildUrl('dashboard'), shortcut: '⌘D', keywords: ['home', 'overview'] },
    { id: 'command-center', title: 'Financial Command Center', icon: Wallet, href: buildUrl('command-center'), shortcut: '⌘F', keywords: ['money', 'finance', 'cash'] },
    { id: 'orders', title: 'Wholesale Orders', icon: ShoppingCart, href: buildUrl('orders'), shortcut: '⌘O', keywords: ['sales', 'purchases'] },
    { id: 'products', title: 'Products', icon: Package, href: buildUrl('inventory/products'), keywords: ['inventory', 'items', 'catalog'] },
    { id: 'clients', title: 'Clients', icon: Users, href: buildUrl('big-plug-clients'), keywords: ['customers', 'businesses'] },
    { id: 'menus', title: 'Disposable Menus', icon: Menu, href: buildUrl('disposable-menus'), shortcut: '⌘M', keywords: ['big plug', 'qr'] },
    { id: 'invoices', title: 'Invoices', icon: FileText, href: buildUrl('crm/invoices'), keywords: ['billing', 'payments'] },
    { id: 'inventory', title: 'Inventory Dashboard', icon: Boxes, href: buildUrl('inventory-hub'), shortcut: '⌘I', keywords: ['stock', 'warehouse'] },
    { id: 'analytics', title: 'Analytics', icon: BarChart3, href: buildUrl('analytics-dashboard'), keywords: ['reports', 'data', 'insights'] },
    { id: 'pos', title: 'Point of Sale', icon: Calculator, href: buildUrl('pos-system'), keywords: ['register', 'checkout'] },
    { id: 'deliveries', title: 'Delivery Management', icon: Truck, href: buildUrl('delivery-management'), keywords: ['shipping', 'courier'] },
    { id: 'live-orders', title: 'Live Orders', icon: Zap, href: buildUrl('orders?tab=live'), keywords: ['active', 'realtime'] },
    { id: 'locations', title: 'Locations', icon: MapPin, href: buildUrl('locations'), keywords: ['stores', 'warehouses'] },
    { id: 'reports', title: 'Reports', icon: TrendingUp, href: buildUrl('reports'), keywords: ['data', 'export'] },
    { id: 'notifications', title: 'Notifications', icon: Bell, href: buildUrl('notifications'), keywords: ['alerts', 'messages'] },
    { id: 'settings', title: 'Settings', icon: Settings, href: buildUrl('settings'), shortcut: '⌘,', keywords: ['preferences', 'config'] },
    { id: 'help', title: 'Help & Support', icon: HelpCircle, href: buildUrl('help'), keywords: ['docs', 'documentation'] },
  ], [buildUrl]);

  // Quick actions
  const quickActions: QuickAction[] = useMemo(() => [
    { id: 'new-order', title: 'Create New Order', icon: Plus, href: buildUrl('orders/new'), keywords: ['add', 'create'] },
    { id: 'new-product', title: 'Add Product', icon: Plus, href: buildUrl('inventory/products?action=new'), keywords: ['add', 'create'] },
    { id: 'new-client', title: 'Add Client', icon: Plus, href: buildUrl('big-plug-clients?action=new'), keywords: ['add', 'create'] },
    { id: 'new-invoice', title: 'Create Invoice', icon: Plus, href: buildUrl('crm/invoices/new'), keywords: ['add', 'create'] },
    { id: 'new-menu', title: 'Create Menu', icon: Plus, href: buildUrl('disposable-menus?action=new'), keywords: ['add', 'create'] },
    { id: 'barcodes', title: 'Generate Barcodes', icon: Tag, href: buildUrl('generate-barcodes'), keywords: ['labels', 'print'] },
  ], [buildUrl]);

  // Filter pages based on search
  const filteredPages = useMemo(() => {
    if (!search) return navigationPages.slice(0, 8);
    const lower = search.toLowerCase();
    return navigationPages.filter((page) =>
      page.title.toLowerCase().includes(lower) ||
      page.id.toLowerCase().includes(lower) ||
      page.keywords?.some((k) => k.toLowerCase().includes(lower))
    );
  }, [navigationPages, search]);

  // Filter actions based on search
  const filteredActions = useMemo(() => {
    if (!search) return quickActions;
    const lower = search.toLowerCase();
    return quickActions.filter((action) =>
      action.title.toLowerCase().includes(lower) ||
      action.id.toLowerCase().includes(lower) ||
      action.keywords?.some((k) => k.toLowerCase().includes(lower))
    );
  }, [quickActions, search]);

  // Handle selection
  const handleSelect = useCallback(
    (href: string, item?: { id: string; type: RecentItem['type']; title: string }) => {
      if (item) {
        saveRecentItem({ ...item, href });
      }
      setOpen(false);
      setSearch('');
      navigate(href);
    },
    [navigate, saveRecentItem]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search pages, orders, clients, products..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          <div className="py-6 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No results found.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Try searching for pages, orders, clients, or products.
            </p>
          </div>
        </CommandEmpty>

        {/* Recent Items */}
        {!search && recentItems.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentItems.map((item) => (
                <CommandItem
                  key={`recent-${item.id}`}
                  value={`recent-${item.id}`}
                  onSelect={() => handleSelect(item.href)}
                >
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.title}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {item.type}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        {filteredActions.length > 0 && (
          <>
            <CommandGroup heading="Quick Actions">
              {filteredActions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={action.id}
                  onSelect={() =>
                    handleSelect(action.href, {
                      id: action.id,
                      type: 'page',
                      title: action.title,
                    })
                  }
                >
                  <action.icon className="mr-2 h-4 w-4 text-emerald-500" />
                  <span>{action.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation Pages */}
        {filteredPages.length > 0 && (
          <CommandGroup heading="Pages">
            {filteredPages.map((page) => (
              <CommandItem
                key={page.id}
                value={page.id}
                onSelect={() =>
                  handleSelect(page.href, {
                    id: page.id,
                    type: 'page',
                    title: page.title,
                  })
                }
              >
                <page.icon className="mr-2 h-4 w-4" />
                <span>{page.title}</span>
                {page.shortcut && (
                  <CommandShortcut>{page.shortcut}</CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Search Results: Products */}
        {products && products.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Products">
              {products.map((product) => (
                <CommandItem
                  key={`product-${product.id}`}
                  value={`product-${product.id}`}
                  onSelect={() =>
                    handleSelect(
                      buildUrl(`inventory/products?id=${product.id}`),
                      {
                        id: `product-${product.id}`,
                        type: 'product',
                        title: product.name,
                      }
                    )
                  }
                >
                  <Package className="mr-2 h-4 w-4 text-blue-500" />
                  <div className="flex flex-col">
                    <span>{product.name}</span>
                    {product.sku && (
                      <span className="text-xs text-muted-foreground">
                        SKU: {product.sku}
                      </span>
                    )}
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Search Results: Clients */}
        {clients && clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clients">
              {clients.map((client) => (
                <CommandItem
                  key={`client-${client.id}`}
                  value={`client-${client.id}`}
                  onSelect={() =>
                    handleSelect(
                      buildUrl(`big-plug-clients/${client.id}`),
                      {
                        id: `client-${client.id}`,
                        type: 'client',
                        title: client.business_name || client.contact_name || 'Client',
                      }
                    )
                  }
                >
                  <Users className="mr-2 h-4 w-4 text-purple-500" />
                  <div className="flex flex-col">
                    <span>{client.business_name || 'Unnamed Business'}</span>
                    {client.contact_name && (
                      <span className="text-xs text-muted-foreground">
                        Contact: {client.contact_name}
                      </span>
                    )}
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Search Results: Orders */}
        {orders && orders.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Orders">
              {orders.map((order) => (
                <CommandItem
                  key={`order-${order.id}`}
                  value={`order-${order.id}`}
                  onSelect={() =>
                    handleSelect(
                      buildUrl(`wholesale-orders?id=${order.id}`),
                      {
                        id: `order-${order.id}`,
                        type: 'order',
                        title: `Order #${order.id.slice(0, 8)}`,
                      }
                    )
                  }
                >
                  <ShoppingCart className="mr-2 h-4 w-4 text-orange-500" />
                  <div className="flex flex-col">
                    <span>Order #{order.id.slice(0, 8)}</span>
                    <span className="text-xs text-muted-foreground">
                      {(order as any).status} • ${((order as any).total_amount || (order as any).total)?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer hint */}
      <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between bg-muted/30">
        <span>
          <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px] mr-1">⌘K</kbd>
          to search
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px] mr-1">↵</kbd>
          to select
        </span>
      </div>
    </CommandDialog>
  );
}

export default TenantAdminCommandPalette;
