/**
 * Tenant Admin Command Palette Component
 * ⌘K quick search and command interface
 * Inspired by VS Code Command Palette and Linear
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Command, Search } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface CommandItem {
  id: string;
  label: string;
  category: string;
  action: () => void;
  shortcut?: string;
  keywords?: string[];
}

export function TenantAdminCommandPalette() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useTenantAdminAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Helper to build tenant-aware paths
  const getPath = (path: string) => {
    if (!tenantSlug) return path;
    return path.startsWith('/admin') ? `/${tenantSlug}${path}` : path;
  };

  // Build commands from navigation structure
  const commands: CommandItem[] = useMemo(() => {
    const baseCommands: CommandItem[] = [
      // Navigation
      {
        id: 'dashboard',
        label: 'Go to Dashboard',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/dashboard')),
        shortcut: '⌘⇧D',
        keywords: ['home', 'overview', 'main'],
      },
      {
        id: 'products',
        label: 'Products',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/inventory/products')),
        keywords: ['inventory', 'items', 'catalog'],
      },
      {
        id: 'inventory-dashboard',
        label: 'Inventory Overview',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/inventory-dashboard')),
        keywords: ['stock', 'warehouse', 'inventory'],
      },
      {
        id: 'disposable-menus',
        label: 'Disposable Menus',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/disposable-menus')),
        shortcut: '⌘M',
        keywords: ['menus', 'big plug', 'crm'],
      },
      {
        id: 'menu-orders',
        label: 'Menu Orders',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/disposable-menu-orders')),
        keywords: ['orders', 'sales'],
      },
      {
        id: 'wholesale-orders',
        label: 'Wholesale Orders',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/wholesale-orders')),
        shortcut: '⌘N',
        keywords: ['new order', 'wholesale', 'b2b'],
      },
      {
        id: 'customers',
        label: 'Customers',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/big-plug-clients')),
        keywords: ['clients', 'users', 'people'],
      },
      {
        id: 'reports',
        label: 'Reports',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/reports')),
        keywords: ['analytics', 'data', 'insights'],
      },
      {
        id: 'financial-center',
        label: 'Financial Center',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/financial-center')),
        keywords: ['money', 'revenue', 'payments', 'billing'],
      },
      {
        id: 'settings',
        label: 'Settings',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/settings')),
        keywords: ['preferences', 'config'],
      },
      {
        id: 'billing',
        label: 'Billing & Subscription',
        category: 'Navigation',
        action: () => navigate(getPath('/admin/billing')),
        keywords: ['subscription', 'plan', 'payment'],
      },
      // Actions
      {
        id: 'new-menu',
        label: 'Create New Menu',
        category: 'Actions',
        action: () => {
          navigate(getPath('/admin/disposable-menus'));
          toast({ title: 'Navigate to create menu' });
        },
        shortcut: '⌘M',
        keywords: ['create', 'new', 'add'],
      },
      {
        id: 'new-order',
        label: 'Create New Order',
        category: 'Actions',
        action: () => {
          navigate(getPath('/admin/wholesale-orders'));
          toast({ title: 'Navigate to create order' });
        },
        shortcut: '⌘N',
        keywords: ['create', 'new', 'add'],
      },
      {
        id: 'new-product',
        label: 'Add New Product',
        category: 'Actions',
        action: () => {
          navigate(getPath('/admin/inventory/products'));
          toast({ title: 'Navigate to add product' });
        },
        keywords: ['create', 'new', 'add'],
      },
      {
        id: 'new-customer',
        label: 'Add New Customer',
        category: 'Actions',
        action: () => {
          navigate(getPath('/admin/big-plug-clients'));
          toast({ title: 'Navigate to add customer' });
        },
        keywords: ['create', 'new', 'add'],
      },
      // Quick Access
      {
        id: 'generate-barcodes',
        label: 'Generate Barcodes',
        category: 'Quick Access',
        action: () => navigate(getPath('/admin/generate-barcodes')),
        keywords: ['barcode', 'labels', 'print'],
      },
      {
        id: 'live-orders',
        label: 'Live Orders Dashboard',
        category: 'Quick Access',
        action: () => navigate(getPath('/admin/live-orders')),
        keywords: ['live', 'active', 'real-time'],
      },
      {
        id: 'inventory',
        label: 'Inventory Management',
        category: 'Quick Access',
        action: () => navigate(getPath('/admin/inventory-dashboard')),
        shortcut: '⌘I',
        keywords: ['stock', 'warehouse', 'inventory'],
      },
      {
        id: 'team-management',
        label: 'Team Management',
        category: 'Quick Access',
        action: () => navigate(getPath('/admin/team-management')),
        keywords: ['users', 'staff', 'employees'],
      },
      {
        id: 'help',
        label: 'Help & Support',
        category: 'Quick Access',
        action: () => navigate(getPath('/admin/help')),
        keywords: ['support', 'docs', 'documentation'],
      },
    ];

    return baseCommands;
  }, [tenantSlug, navigate, toast]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;

    const searchLower = search.toLowerCase();
    return commands.filter((cmd) => {
      const labelMatch = cmd.label.toLowerCase().includes(searchLower);
      const categoryMatch = cmd.category.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some(kw => kw.toLowerCase().includes(searchLower));
      return labelMatch || categoryMatch || keywordMatch;
    });
  }, [commands, search]);

  // Group by category
  const groupedCommands = useMemo(() => {
    return filteredCommands.reduce((acc, cmd) => {
      if (!acc[cmd.category]) {
        acc[cmd.category] = [];
      }
      acc[cmd.category].push(cmd);
      return acc;
    }, {} as Record<string, CommandItem[]>);
  }, [filteredCommands]);

  // Keyboard shortcut handler
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to open command palette
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleCommand = (command: CommandItem) => {
    command.action();
    setOpen(false);
    setSearch('');
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 max-h-[80vh]">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 text-base"
            autoFocus
          />
          <Badge variant="outline" className="ml-2 hidden sm:flex">
            <Command className="h-3 w-3 mr-1" />
            K
          </Badge>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {Object.keys(groupedCommands).length > 0 ? (
            Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="mb-4">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {category}
                </div>
                {items.map((command) => (
                  <div
                    key={command.id}
                    className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => handleCommand(command)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCommand(command);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={command.label}
                  >
                    <span className="text-sm">{command.label}</span>
                    {command.shortcut && (
                      <Badge variant="outline" className="text-xs font-mono">
                        {command.shortcut}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="px-2 py-8 text-center text-muted-foreground">
              <p className="text-sm">No commands found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
        <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> to close</span>
          <span>Use <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑</kbd> <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↓</kbd> to navigate</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

