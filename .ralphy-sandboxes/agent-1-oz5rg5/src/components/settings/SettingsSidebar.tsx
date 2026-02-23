import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  Shield,
  Building2,
  Bell,
  CreditCard,
  Users,
  Plug,
  Palette,
  Search,
  ChevronLeft,
  AlertCircle,
  X,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export type SettingsSection =
  | 'account'
  | 'security'
  | 'business'
  | 'notifications'
  | 'billing'
  | 'team'
  | 'integrations'
  | 'appearance';

interface SettingsNavItem {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  badge?: string;
  attention?: boolean;
}

const NAV_ITEMS: SettingsNavItem[] = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'security', label: 'Security', icon: Shield, attention: true },
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'billing', label: 'Billing', icon: CreditCard, badge: 'Pro' },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onBack?: () => void;
  className?: string;
  isMobile?: boolean;
  onMobileClose?: () => void;
}

export function SettingsSidebar({
  activeSection,
  onSectionChange,
  onBack,
  className,
  isMobile = false,
  onMobileClose,
}: SettingsSidebarProps) {
  const [search, setSearch] = useState('');

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleItemClick = (id: SettingsSection) => {
    onSectionChange(id);
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-muted/30 border-r',
        isMobile ? 'w-full h-full' : 'w-64 min-h-dvh sticky top-0',
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2 -ml-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="font-medium">Settings</span>
            </Button>
          )}
          {isMobile && onMobileClose && (
            <Button variant="ghost" size="icon" onClick={onMobileClose}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search settings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 p-2">
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <Badge
                    variant={isActive ? 'secondary' : 'outline'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {item.badge}
                  </Badge>
                )}
                {item.attention && !item.badge && (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
              </button>
            );
          })}
        </nav>

        {filteredItems.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No settings found
          </p>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t text-center">
        <p className="text-xs text-muted-foreground">
          Press{' '}
          <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted rounded border">
            /
          </kbd>{' '}
          to search
        </p>
      </div>
    </div>
  );
}

