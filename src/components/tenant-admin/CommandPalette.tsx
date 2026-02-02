/**
 * Global Command Palette Component
 * Opens with Cmd+K / Ctrl+K keyboard shortcut
 *
 * Features:
 * - Real-time search across orders, customers, products
 * - Recent searches history (persisted in localStorage)
 * - Quick navigation to admin pages
 * - Quick action shortcuts for creating entities
 * - Debounced database search (300ms)
 * - Tenant-aware with proper isolation
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Button } from '@/components/ui/button';
import LayoutDashboard from "lucide-react/dist/esm/icons/layout-dashboard";
import Package from "lucide-react/dist/esm/icons/package";
import Users from "lucide-react/dist/esm/icons/users";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Settings from "lucide-react/dist/esm/icons/settings";
import Search from "lucide-react/dist/esm/icons/search";
import Plus from "lucide-react/dist/esm/icons/plus";
import Boxes from "lucide-react/dist/esm/icons/boxes";
import Truck from "lucide-react/dist/esm/icons/truck";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import Calculator from "lucide-react/dist/esm/icons/calculator";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import Clock from "lucide-react/dist/esm/icons/clock";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Menu from "lucide-react/dist/esm/icons/menu";
import Bell from "lucide-react/dist/esm/icons/bell";
import Zap from "lucide-react/dist/esm/icons/zap";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle";
import Tag from "lucide-react/dist/esm/icons/tag";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import X from "lucide-react/dist/esm/icons/x";
import History from "lucide-react/dist/esm/icons/history";
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { STORAGE_KEYS, safeJsonParse, safeJsonStringify } from '@/constants/storageKeys';
import { logger } from '@/lib/logger';

// ─── Global State ────────────────────────────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecentSearchItem {
  id: string;
  type: 'customer' | 'order' | 'product' | 'page';
  label: string;
  sublabel?: string;
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

interface CustomerRow {
  id: string;
  business_name: string | null;
  contact_name: string | null;
}

interface OrderRow {
  id: string;
  total_amount: number | null;
  status: string | null;
  created_at: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_RECENT_SEARCHES = 5;

// ─── Component ───────────────────────────────────────────────────────────────

export function TenantAdminCommandPalette() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();

  const { open, setOpen, toggle } = useCommandPaletteStore();
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Search result state
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [orderResults, setOrderResults] = useState<OrderRow[]>([]);
  const [productResults, setProductResults] = useState<ProductRow[]>([]);

  // Recent searches from localStorage
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.COMMAND_PALETTE_RECENT_SEARCHES);
    return safeJsonParse<RecentSearchItem[]>(stored, []);
  });

  // ─── Keyboard Shortcut ─────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // ─── Build Tenant URL ──────────────────────────────────────────────────────

  const buildUrl = useCallback((path: string) => {
    if (!tenantSlug) return path;
    return `/${tenantSlug}/admin/${path}`;
  }, [tenantSlug]);

  // ─── Debounced Search ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      setSearch('');
      setCustomerResults([]);
      setOrderResults([]);
      setProductResults([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (search.length < 2 || !tenant?.id) {
      setCustomerResults([]);
      setOrderResults([]);
      setProductResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const [customersRes, ordersRes, productsRes] = await Promise.all([
          supabase
            .from('wholesale_clients')
            .select('id, business_name, contact_name')
            .eq('tenant_id', tenant.id)
            .or(`business_name.ilike.%${search}%,contact_name.ilike.%${search}%`)
            .limit(5),

          supabase
            .from('orders')
            .select('id, status, total_amount, created_at')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false })
            .limit(5),

          supabase
            .from('products')
            .select('id, name, sku, category')
            .eq('tenant_id', tenant.id)
            .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
            .limit(5),
        ]);

        setCustomerResults(
          (customersRes.data as unknown as CustomerRow[]) || []
        );
        setOrderResults(
          (ordersRes.data as unknown as OrderRow[]) || []
        );
        setProductResults(
          (productsRes.data as unknown as ProductRow[]) || []
        );
      } catch (error) {
        logger.error('Command palette search failed', error);
        setCustomerResults([]);
        setOrderResults([]);
        setProductResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, tenant?.id]);

  // ─── Recent Searches ───────────────────────────────────────────────────────

  const saveRecentSearch = useCallback((item: Omit<RecentSearchItem, 'timestamp'>) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (r) => !(r.id === item.id && r.type === item.type)
      );
      const updated: RecentSearchItem[] = [
        { ...item, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT_SEARCHES);

      const json = safeJsonStringify(updated);
      if (json) {
        try {
          localStorage.setItem(STORAGE_KEYS.COMMAND_PALETTE_RECENT_SEARCHES, json);
        } catch {
          // Ignore storage errors (incognito mode)
        }
      }
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEYS.COMMAND_PALETTE_RECENT_SEARCHES);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // ─── Navigation Pages ──────────────────────────────────────────────────────

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
    { id: 'notifications', title: 'Notifications', icon: Bell, href: buildUrl('notifications'), keywords: ['alerts', 'messages'] },
    { id: 'settings', title: 'Settings', icon: Settings, href: buildUrl('settings'), shortcut: '⌘,', keywords: ['preferences', 'config'] },
    { id: 'help', title: 'Help & Support', icon: HelpCircle, href: buildUrl('help'), keywords: ['docs', 'documentation'] },
  ], [buildUrl]);

  // ─── Quick Actions ─────────────────────────────────────────────────────────

  const quickActions: QuickAction[] = useMemo(() => [
    { id: 'new-order', title: 'Create New Order', icon: Plus, href: buildUrl('orders/new'), keywords: ['add', 'create', 'order'] },
    { id: 'new-product', title: 'Add Product', icon: Plus, href: buildUrl('inventory/products?action=new'), keywords: ['add', 'create', 'product'] },
    { id: 'new-client', title: 'Add Client', icon: Plus, href: buildUrl('big-plug-clients?action=new'), keywords: ['add', 'create', 'customer'] },
    { id: 'new-invoice', title: 'Create Invoice', icon: Plus, href: buildUrl('crm/invoices/new'), keywords: ['add', 'create', 'invoice'] },
    { id: 'new-menu', title: 'Create Menu', icon: Plus, href: buildUrl('disposable-menus?action=new'), keywords: ['add', 'create', 'menu'] },
    { id: 'barcodes', title: 'Generate Barcodes', icon: Tag, href: buildUrl('generate-barcodes'), keywords: ['labels', 'print'] },
  ], [buildUrl]);

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const filteredPages = useMemo(() => {
    if (!search) return navigationPages.slice(0, 6);
    const lower = search.toLowerCase();
    return navigationPages.filter((page) =>
      page.title.toLowerCase().includes(lower) ||
      page.id.toLowerCase().includes(lower) ||
      page.keywords?.some((k) => k.toLowerCase().includes(lower))
    );
  }, [navigationPages, search]);

  const filteredActions = useMemo(() => {
    if (!search) return quickActions;
    const lower = search.toLowerCase();
    return quickActions.filter((action) =>
      action.title.toLowerCase().includes(lower) ||
      action.id.toLowerCase().includes(lower) ||
      action.keywords?.some((k) => k.toLowerCase().includes(lower))
    );
  }, [quickActions, search]);

  // ─── Selection Handler ─────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (href: string, item?: Omit<RecentSearchItem, 'timestamp' | 'href'>) => {
      if (item) {
        saveRecentSearch({ ...item, href });
      }
      setOpen(false);
      setSearch('');
      navigate(href);
    },
    [navigate, saveRecentSearch, setOpen]
  );

  // ─── Computed ──────────────────────────────────────────────────────────────

  const hasDataResults = customerResults.length > 0 || orderResults.length > 0 || productResults.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search orders, customers, products..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Searching...</span>
            </div>
          ) : (
            <div className="py-6 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No results found.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Try searching for orders, customers, or products.
              </p>
            </div>
          )}
        </CommandEmpty>

        {/* Recent Searches - shown when no active search */}
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
              {recentSearches.map((item) => (
                <CommandItem
                  key={`recent-${item.type}-${item.id}`}
                  value={`recent-${item.type}-${item.id}`}
                  onSelect={() => handleSelect(item.href)}
                  className="min-h-[44px]"
                >
                  <History className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {item.type}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Data Search Results: Customers */}
        {customerResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Customers">
              {customerResults.map((customer) => (
                <CommandItem
                  key={`customer-${customer.id}`}
                  value={`customer-${customer.id}-${customer.business_name || ''}`}
                  onSelect={() =>
                    handleSelect(
                      buildUrl(`big-plug-clients/${customer.id}`),
                      {
                        id: customer.id,
                        type: 'customer',
                        label: customer.business_name || 'Unnamed Client',
                        sublabel: customer.contact_name || undefined,
                      }
                    )
                  }
                  className="min-h-[44px]"
                >
                  <Users className="mr-2 h-4 w-4 text-purple-500" />
                  <div className="flex flex-col">
                    <span>{customer.business_name || 'Unnamed Business'}</span>
                    {customer.contact_name && (
                      <span className="text-xs text-muted-foreground">
                        Contact: {customer.contact_name}
                      </span>
                    )}
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Data Search Results: Orders */}
        {orderResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Orders">
              {orderResults.map((order) => (
                <CommandItem
                  key={`order-${order.id}`}
                  value={`order-${order.id}`}
                  onSelect={() =>
                    handleSelect(
                      buildUrl(`orders?id=${order.id}`),
                      {
                        id: order.id,
                        type: 'order',
                        label: `Order #${order.id.slice(0, 8)}`,
                        sublabel: order.status || undefined,
                      }
                    )
                  }
                  className="min-h-[44px]"
                >
                  <ShoppingCart className="mr-2 h-4 w-4 text-orange-500" />
                  <div className="flex flex-col">
                    <span>Order #{order.id.slice(0, 8)}</span>
                    <span className="text-xs text-muted-foreground">
                      {order.status || 'Unknown'} {order.total_amount != null && `• $${order.total_amount.toFixed(2)}`}
                    </span>
                  </div>
                  <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Data Search Results: Products */}
        {productResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Products">
              {productResults.map((product) => (
                <CommandItem
                  key={`product-${product.id}`}
                  value={`product-${product.id}-${product.name}`}
                  onSelect={() =>
                    handleSelect(
                      buildUrl(`inventory/products?id=${product.id}`),
                      {
                        id: product.id,
                        type: 'product',
                        label: product.name,
                        sublabel: product.sku ? `SKU: ${product.sku}` : undefined,
                      }
                    )
                  }
                  className="min-h-[44px]"
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

        {/* Loading indicator for data search */}
        {isSearching && search.length >= 2 && !hasDataResults && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Searching database...</span>
          </div>
        )}

        {/* Quick Actions */}
        {filteredActions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              {filteredActions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={`action-${action.id}`}
                  onSelect={() =>
                    handleSelect(action.href, {
                      id: action.id,
                      type: 'page',
                      label: action.title,
                    })
                  }
                  className="min-h-[44px]"
                >
                  <action.icon className="mr-2 h-4 w-4 text-emerald-500" />
                  <span>{action.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Navigation Pages */}
        {filteredPages.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {filteredPages.map((page) => (
                <CommandItem
                  key={page.id}
                  value={`page-${page.id}`}
                  onSelect={() =>
                    handleSelect(page.href, {
                      id: page.id,
                      type: 'page',
                      label: page.title,
                    })
                  }
                  className="min-h-[44px]"
                >
                  <page.icon className="mr-2 h-4 w-4" />
                  <span>{page.title}</span>
                  {page.shortcut && (
                    <CommandShortcut>{page.shortcut}</CommandShortcut>
                  )}
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
          to toggle
        </span>
        <span className="flex items-center gap-3">
          <span>
            <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px] mr-1">↑↓</kbd>
            navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px] mr-1">↵</kbd>
            select
          </span>
        </span>
      </div>
    </CommandDialog>
  );
}
