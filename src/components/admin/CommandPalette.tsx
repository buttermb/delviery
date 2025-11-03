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
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
  category?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { account } = useAccount();
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time data search
  const { data: searchResults } = useQuery({
    queryKey: ['command-palette-search', searchTerm, account?.id],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2 || !account?.id) return null;

      try {
        const [clientsResult, ordersResult, productsResult] = await Promise.all([
          supabase
            .from('wholesale_clients')
            .select('id, business_name, contact_name, phone')
            .eq('tenant_id', account.id)
            .ilike('business_name', `%${searchTerm}%`)
            .limit(5),
          supabase
            .from('wholesale_orders')
            .select('id, order_number, total_amount, status')
            .eq('tenant_id', account.id)
            .ilike('order_number', `%${searchTerm}%`)
            .limit(5),
          supabase
            .from('wholesale_inventory')
            .select('id, product_name, current_stock')
            .eq('tenant_id', account.id)
            .ilike('product_name', `%${searchTerm}%`)
            .limit(5),
        ]);

        return {
          clients: clientsResult.data || [],
          orders: ordersResult.data || [],
          products: productsResult.data || [],
        };
      } catch (error: any) {
        // Gracefully handle missing tables
        if (error.code === '42P01') return null;
        throw error;
      }
    },
    enabled: searchTerm.length >= 2 && !!account?.id,
  });

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Navigation commands
  const navigationCommands: CommandItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      shortcut: '⌘D',
      action: () => navigate('/admin/dashboard'),
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: Package,
      action: () => navigate('/admin/wholesale-orders'),
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: Users,
      action: () => navigate('/admin/wholesale-clients'),
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Warehouse,
      action: () => navigate('/admin/inventory-dashboard'),
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      action: () => navigate('/admin/reports'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      action: () => navigate('/admin/settings'),
    },
  ];

  const handleSelect = (command: CommandItem) => {
    command.action();
    setOpen(false);
    setSearchTerm('');
  };

  const hasSearchResults = searchResults && (
    searchResults.clients.length > 0 ||
    searchResults.orders.length > 0 ||
    searchResults.products.length > 0
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Search commands, customers, orders, products..." 
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList>
        {hasSearchResults ? (
          <>
            {searchResults.clients.length > 0 && (
              <CommandGroup heading="Customers">
                {searchResults.clients.map((client: any) => (
                  <CommandItem
                    key={client.id}
                    onSelect={() => {
                      navigate(`/admin/wholesale-clients/${client.id}`);
                      setOpen(false);
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    <span>{client.business_name || client.contact_name}</span>
                    <CommandShortcut>→</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {searchResults.orders.length > 0 && (
              <CommandGroup heading="Orders">
                {searchResults.orders.map((order: any) => (
                  <CommandItem
                    key={order.id}
                    onSelect={() => {
                      navigate(`/admin/wholesale-orders/${order.id}`);
                      setOpen(false);
                    }}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    <span>{order.order_number}</span>
                    <Badge variant="outline" className="ml-2">
                      {order.status}
                    </Badge>
                    <CommandShortcut>→</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {searchResults.products.length > 0 && (
              <CommandGroup heading="Products">
                {searchResults.products.map((product: any) => (
                  <CommandItem
                    key={product.id}
                    onSelect={() => {
                      navigate(`/admin/inventory-dashboard?product=${product.id}`);
                      setOpen(false);
                    }}
                  >
                    <Tag className="mr-2 h-4 w-4" />
                    <span>{product.product_name}</span>
                    <Badge variant="outline" className="ml-2">
                      {product.current_stock} in stock
                    </Badge>
                    <CommandShortcut>→</CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigation">
              {navigationCommands.map((command) => (
                <CommandItem
                  key={command.id}
                  onSelect={() => handleSelect(command)}
                >
                  <command.icon className="mr-2 h-4 w-4" />
                  <span>{command.label}</span>
                  {command.shortcut && (
                    <CommandShortcut>{command.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

