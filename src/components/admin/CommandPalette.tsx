/**
 * ⌘K Command Palette - Quick Navigation & Actions
 * Modern command palette for fast access to all features
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Package, Menu, Plus, Users, DollarSign, 
  Truck, FileText, Settings, BarChart3, Lock, Image,
  ArrowRight, Sparkles, Shield, Bell, Printer, Tag, Warehouse
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  // Filter commands based on search
  const filteredCommands = search
    ? commands.filter(cmd => {
        const searchLower = search.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(searchLower) ||
          cmd.keywords?.some(k => k.toLowerCase().includes(searchLower)) ||
          cmd.category.toLowerCase().includes(searchLower)
        );
      })
    : commands;

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }

      if (open) {
        if (e.key === 'Escape') {
          setOpen(false);
          setSearch('');
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
        }
        if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
          e.preventDefault();
          handleSelect(filteredCommands[selectedIndex]);
        }
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, selectedIndex, filteredCommands]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <div className="flex items-center border-b px-4 py-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Type a command or search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {Object.keys(groupedCommands).length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, items]) => (
                <div key={category} className="px-2 py-2">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                    {category}
                  </div>
                  <div className="space-y-1">
                    {items.map((cmd, index) => {
                      const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                      const isSelected = globalIndex === selectedIndex;
                      
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => handleSelect(cmd)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm',
                            'hover:bg-muted transition-colors',
                            isSelected && 'bg-muted'
                          )}
                        >
                          <div className={cn(
                            'flex-shrink-0',
                            isSelected ? 'text-primary' : 'text-muted-foreground'
                          )}>
                            {cmd.icon}
                          </div>
                          <span className="flex-1 text-left">{cmd.label}</span>
                          {cmd.shortcut && (
                            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                              {cmd.shortcut}
                            </kbd>
                          )}
                          <ArrowRight className={cn(
                            'h-4 w-4 transition-opacity',
                            isSelected ? 'opacity-100' : 'opacity-0'
                          )} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Navigate with ↑↓ and press Enter to select</span>
              <span>Esc to close</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

