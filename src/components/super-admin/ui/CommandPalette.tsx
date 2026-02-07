/**
 * Command Palette Component
 * ⌘K quick search and command interface
 * Inspired by VS Code Command Palette and Linear
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Command, Search, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface CommandItem {
  id: string;
  label: string;
  category: string;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const commands: CommandItem[] = [
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      category: 'Navigation',
      action: () => navigate('/super-admin/dashboard'),
    },
    {
      id: 'monitoring',
      label: 'System Monitoring',
      category: 'Navigation',
      action: () => navigate('/super-admin/monitoring'),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      category: 'Navigation',
      action: () => navigate('/super-admin/analytics'),
    },
    {
      id: 'revenue',
      label: 'Revenue Analytics',
      category: 'Navigation',
      action: () => navigate('/super-admin/revenue-analytics'),
    },
    {
      id: 'data-explorer',
      label: 'Data Explorer',
      category: 'Navigation',
      action: () => navigate('/super-admin/data-explorer'),
    },
    {
      id: 'api-usage',
      label: 'API Usage',
      category: 'Navigation',
      action: () => navigate('/super-admin/api-usage'),
    },
    {
      id: 'audit-logs',
      label: 'Audit Logs',
      category: 'Navigation',
      action: () => navigate('/super-admin/audit-logs'),
    },
    {
      id: 'workflows',
      label: 'Workflows',
      category: 'Navigation',
      action: () => navigate('/super-admin/workflows'),
    },
    {
      id: 'communication',
      label: 'Communication',
      category: 'Navigation',
      action: () => navigate('/super-admin/communication'),
    },
    {
      id: 'feature-flags',
      label: 'Feature Flags',
      category: 'Navigation',
      action: () => navigate('/super-admin/feature-flags'),
    },
    {
      id: 'system-config',
      label: 'System Configuration',
      category: 'Navigation',
      action: () => navigate('/super-admin/system-config'),
    },
    {
      id: 'security',
      label: 'Security',
      category: 'Navigation',
      action: () => navigate('/super-admin/security'),
    },
  ];

  // Filter commands based on search
  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
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

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Type a command or search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 focus-visible:ring-0"
              autoFocus
            />
            <Badge variant="outline" className="ml-2">
              <Command className="h-3 w-3 mr-1" />
              K
            </Badge>
          </div>
          <div className="max-h-[400px] overflow-y-auto p-2">
            {Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="mb-4">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {category}
                </div>
                {items.map((command) => (
                  <div
                    key={command.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                    onClick={() => handleCommand(command)}
                  >
                    <span>{command.label}</span>
                    {command.shortcut && (
                      <Badge variant="outline" className="text-xs">
                        {command.shortcut}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {filteredCommands.length === 0 && (
              <div className="px-2 py-8 text-center text-muted-foreground">
                No commands found
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

