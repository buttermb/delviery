/**
 * Enhanced Command Palette Component
 * ⌘K quick search and command interface using cmdk
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
} from '@/components/ui/command';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  BarChart3,
  Settings,
  Mail,
  Shield,
  Activity,
  Database,
  FileText,
  Workflow,
  Flag,
  TrendingUp,
  Search,
  Plus,
  FileSearch,
  User,
  Bell,
  Zap,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('');
    }
  }, [open]);

  const commands = useMemo(() => {
    const baseCommands = [
      // Navigation
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        action: () => navigate('/super-admin/dashboard'),
        shortcut: '⌘1',
        keywords: ['home', 'overview', 'main'],
      },
      {
        id: 'tenants',
        label: 'All Tenants',
        icon: Building2,
        action: () => navigate('/super-admin/tenants'),
        shortcut: '⌘2',
        keywords: ['tenant', 'customers', 'clients'],
      },
      {
        id: 'revenue',
        label: 'Revenue Analytics',
        icon: DollarSign,
        action: () => navigate('/super-admin/revenue-analytics'),
        shortcut: '⌘3',
        keywords: ['mrr', 'arr', 'money', 'billing'],
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        action: () => navigate('/super-admin/analytics'),
        shortcut: '⌘4',
        keywords: ['stats', 'metrics', 'data'],
      },
      {
        id: 'monitoring',
        label: 'System Monitoring',
        icon: Activity,
        action: () => navigate('/super-admin/monitoring'),
        shortcut: '⌘5',
        keywords: ['health', 'system', 'status'],
      },
      {
        id: 'communication',
        label: 'Communication',
        icon: Mail,
        action: () => navigate('/super-admin/communication'),
        shortcut: '⌘6',
        keywords: ['email', 'messages', 'campaigns'],
      },
      {
        id: 'security',
        label: 'Security',
        icon: Shield,
        action: () => navigate('/super-admin/security'),
        shortcut: '⌘7',
        keywords: ['access', 'permissions', 'audit'],
      },
      {
        id: 'data-explorer',
        label: 'Data Explorer',
        icon: Database,
        action: () => navigate('/super-admin/data-explorer'),
        keywords: ['database', 'query', 'sql'],
      },
      {
        id: 'api-usage',
        label: 'API Usage',
        icon: Activity,
        action: () => navigate('/super-admin/api-usage'),
        keywords: ['api', 'requests', 'endpoints'],
      },
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        icon: FileSearch,
        action: () => navigate('/super-admin/audit-logs'),
        keywords: ['logs', 'history', 'activity'],
      },
      {
        id: 'workflows',
        label: 'Workflows',
        icon: Workflow,
        action: () => navigate('/super-admin/workflows'),
        keywords: ['automation', 'jobs', 'tasks'],
      },
      {
        id: 'feature-flags',
        label: 'Feature Flags',
        icon: Flag,
        action: () => navigate('/super-admin/feature-flags'),
        keywords: ['features', 'toggles', 'rollout'],
      },
      {
        id: 'report-builder',
        label: 'Report Builder',
        icon: FileText,
        action: () => navigate('/super-admin/report-builder'),
        keywords: ['reports', 'export', 'custom'],
      },
      {
        id: 'executive-dashboard',
        label: 'Executive Dashboard',
        icon: TrendingUp,
        action: () => navigate('/super-admin/executive-dashboard'),
        keywords: ['executive', 'summary', 'overview'],
      },
      {
        id: 'system-config',
        label: 'System Configuration',
        icon: Settings,
        action: () => navigate('/super-admin/system-config'),
        keywords: ['settings', 'config', 'preferences'],
      },
      {
        id: 'tools',
        label: 'Admin Tools',
        icon: Settings,
        action: () => navigate('/super-admin/tools'),
        keywords: ['tools', 'utilities', 'admin'],
      },
    ];

    // Actions
    const actionCommands = [
      {
        id: 'create-tenant',
        label: 'Create New Tenant',
        icon: Plus,
        action: () => navigate('/super-admin/tenants/new'),
        shortcut: '⌘N',
        keywords: ['new', 'add', 'create'],
      },
      {
        id: 'find-tenant',
        label: 'Find Tenant',
        icon: Search,
        action: () => {
          navigate('/super-admin/tenants');
          // TODO: Focus search input
        },
        shortcut: '⌘T',
        keywords: ['search', 'find', 'tenant'],
      },
      {
        id: 'generate-report',
        label: 'Generate Report',
        icon: FileText,
        action: () => navigate('/super-admin/report-builder'),
        shortcut: '⌘R',
        keywords: ['report', 'export', 'generate'],
      },
      {
        id: 'send-announcement',
        label: 'Send Announcement',
        icon: Bell,
        action: () => navigate('/super-admin/communication'),
        keywords: ['announce', 'notify', 'message'],
      },
    ];

    return {
      navigation: baseCommands,
      actions: actionCommands,
    };
  }, [navigate]);

  // Filter commands based on search
  const filterCommands = (cmds: typeof commands.navigation, query: string) => {
    if (!query) return cmds;
    const lowerQuery = query.toLowerCase();
    return cmds.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.keywords?.some((kw) => kw.toLowerCase().includes(lowerQuery))
    );
  };

  const filteredNavigation = filterCommands(commands.navigation, search);
  const filteredActions = filterCommands(commands.actions, search);

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
        data-command-input
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {filteredActions.length > 0 && (
          <>
            <CommandGroup heading="Actions">
              {filteredActions.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem
                    key={cmd.id}
                    onSelect={() => handleSelect(cmd.action)}
                    keywords={cmd.keywords}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="ml-auto text-xs text-muted-foreground font-mono">
                        {cmd.shortcut}
                      </kbd>
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
                  keywords={cmd.keywords}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className="ml-auto text-xs text-muted-foreground font-mono">
                      {cmd.shortcut}
                    </kbd>
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

