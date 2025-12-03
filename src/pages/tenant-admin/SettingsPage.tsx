import { useState, useEffect, Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  User,
  Shield,
  Building2,
  Bell,
  CreditCard,
  Users,
  Plug,
  Palette,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Lazy load settings sections for better performance
const AccountSettings = lazy(() => import('./settings/AccountSettings'));
const SecuritySettings = lazy(() => import('./settings/SecuritySettings'));
const BusinessSettings = lazy(() => import('./settings/BusinessSettings'));
const NotificationSettings = lazy(() => import('./settings/NotificationSettings'));
const BillingSettings = lazy(() => import('./settings/BillingSettings'));
const TeamSettings = lazy(() => import('./settings/TeamSettings'));
const IntegrationsSettings = lazy(() => import('./settings/IntegrationsSettings'));
const AppearanceSettings = lazy(() => import('./settings/AppearanceSettings'));

type SettingsSection =
  | 'account'
  | 'security'
  | 'business'
  | 'notifications'
  | 'billing'
  | 'team'
  | 'integrations'
  | 'appearance';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: typeof User;
  badge?: string;
  attention?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'security', label: 'Security', icon: Shield, attention: true },
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'billing', label: 'Billing', icon: CreditCard, badge: 'Pro' },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

function SettingsLoadingFallback() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function TenantAdminSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get initial section from URL or default to 'account'
  const sectionParam = searchParams.get('section') as SettingsSection | null;
  const [activeSection, setActiveSection] = useState<SettingsSection>(
    sectionParam || 'account'
  );

  // Sync URL with active section
  useEffect(() => {
    if (activeSection !== sectionParam) {
      setSearchParams({ section: activeSection }, { replace: true });
    }
  }, [activeSection, sectionParam, setSearchParams]);

  const renderContent = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettings key="account" />;
      case 'security':
        return <SecuritySettings key="security" />;
      case 'business':
        return <BusinessSettings key="business" />;
      case 'notifications':
        return <NotificationSettings key="notifications" />;
      case 'billing':
        return <BillingSettings key="billing" />;
      case 'team':
        return <TeamSettings key="team" />;
      case 'integrations':
        return <IntegrationsSettings key="integrations" />;
      case 'appearance':
        return <AppearanceSettings key="appearance" />;
      default:
        return <AccountSettings key="account" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account, security, and preferences
          </p>
        </div>
      </div>

      {/* Horizontal Navigation */}
      <ScrollArea className="w-full">
        <div className="flex gap-1 pb-3 border-b">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <Badge
                    variant={isActive ? 'secondary' : 'outline'}
                    className="text-[10px] px-1.5 py-0 ml-1"
                  >
                    {item.badge}
                  </Badge>
                )}
                {item.attention && !item.badge && (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                )}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Content */}
      <Suspense fallback={<SettingsLoadingFallback />}>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {renderContent()}
        </div>
      </Suspense>
    </div>
  );
}
