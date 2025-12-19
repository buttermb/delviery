import { Suspense, lazy, useCallback, useRef, useEffect, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
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

const VALID_SECTIONS: SettingsSection[] = [
  'account',
  'security',
  'business',
  'notifications',
  'billing',
  'team',
  'integrations',
  'appearance',
];

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
        <Skeleton className="h-4 w-full max-w-96" />
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
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);

  // Read section directly from URL - no useState sync needed
  const sectionParam = searchParams.get('section');
  const activeSection: SettingsSection = 
    sectionParam && VALID_SECTIONS.includes(sectionParam as SettingsSection)
      ? (sectionParam as SettingsSection)
      : 'account';

  // Handle section change - update URL directly without state
  const handleSectionChange = useCallback((section: SettingsSection) => {
    // Only update if different to prevent unnecessary updates
    if (section !== activeSection) {
      setSearchParams({ section }, { replace: true });
    }
  }, [activeSection, setSearchParams]);

  // Track scroll position for fade indicators
  const handleScroll = useCallback(() => {
    const container = tabsContainerRef.current;
    if (!container) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftFade(scrollLeft > 10);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  // Initialize scroll state
  useEffect(() => {
    handleScroll();
  }, [handleScroll]);

  // Scroll active tab into view on mount/change
  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const activeButton = container.querySelector(`[data-section="${activeSection}"]`);
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeSection]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3 px-1">
        <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            Manage your account, security, and preferences
          </p>
        </div>
      </div>

      {/* Horizontal Navigation - Mobile Optimized */}
      <div className="relative">
        {/* Left fade indicator */}
        <div 
          className={cn(
            "absolute left-0 top-0 bottom-3 w-8 sm:w-12 bg-gradient-to-r from-background via-background/80 to-transparent z-10 pointer-events-none transition-opacity duration-200",
            showLeftFade ? "opacity-100" : "opacity-0"
          )}
        >
          <ChevronLeft className="absolute left-1 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>

        {/* Tabs container */}
        <div 
          ref={tabsContainerRef}
          onScroll={handleScroll}
          className="flex gap-1 sm:gap-1.5 pb-3 border-b overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                data-section={item.id}
                onClick={() => handleSectionChange(item.id)}
                className={cn(
                  // Base styles
                  'flex items-center gap-1.5 sm:gap-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                  // Mobile-first sizing - 48px min touch target
                  'min-h-[48px] px-3 sm:px-4 py-2.5',
                  // Touch feedback
                  'touch-manipulation active:scale-[0.98]',
                  // Hover/focus states
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  // Active state
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="hidden xs:inline sm:inline">{item.label}</span>
                {/* Show abbreviated label on very small screens */}
                <span className="xs:hidden sm:hidden">{item.label.slice(0, 3)}</span>
                {item.badge && (
                  <Badge
                    variant={isActive ? 'secondary' : 'outline'}
                    className="text-[10px] px-1.5 py-0 ml-0.5 sm:ml-1 hidden sm:inline-flex"
                  >
                    {item.badge}
                  </Badge>
                )}
                {item.attention && !item.badge && (
                  <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right fade indicator */}
        <div 
          className={cn(
            "absolute right-0 top-0 bottom-3 w-8 sm:w-12 bg-gradient-to-l from-background via-background/80 to-transparent z-10 pointer-events-none transition-opacity duration-200",
            showRightFade ? "opacity-100" : "opacity-0"
          )}
        >
          <ChevronRight className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Content - All sections rendered, visibility controlled via CSS */}
      {/* This prevents re-mounting and preserves component state */}
      <div className="min-h-[50vh]">
      <Suspense fallback={<SettingsLoadingFallback />}>
          <div className={cn(activeSection === 'account' ? 'block' : 'hidden')}>
            <AccountSettings />
          </div>
          <div className={cn(activeSection === 'security' ? 'block' : 'hidden')}>
            <SecuritySettings />
          </div>
          <div className={cn(activeSection === 'business' ? 'block' : 'hidden')}>
            <BusinessSettings />
          </div>
          <div className={cn(activeSection === 'notifications' ? 'block' : 'hidden')}>
            <NotificationSettings />
          </div>
          <div className={cn(activeSection === 'billing' ? 'block' : 'hidden')}>
            <BillingSettings />
          </div>
          <div className={cn(activeSection === 'team' ? 'block' : 'hidden')}>
            <TeamSettings />
          </div>
          <div className={cn(activeSection === 'integrations' ? 'block' : 'hidden')}>
            <IntegrationsSettings />
          </div>
          <div className={cn(activeSection === 'appearance' ? 'block' : 'hidden')}>
            <AppearanceSettings />
        </div>
      </Suspense>
      </div>
    </div>
  );
}
