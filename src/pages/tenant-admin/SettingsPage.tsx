import { useState, useEffect, Suspense, lazy } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { SettingsSidebar, SettingsSection } from '@/components/settings/SettingsSidebar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load settings sections for better performance
const AccountSettings = lazy(() => import('./settings/AccountSettings'));
const SecuritySettings = lazy(() => import('./settings/SecuritySettings'));
const BusinessSettings = lazy(() => import('./settings/BusinessSettings'));
const NotificationSettings = lazy(() => import('./settings/NotificationSettings'));
const BillingSettings = lazy(() => import('./settings/BillingSettings'));
const TeamSettings = lazy(() => import('./settings/TeamSettings'));
const IntegrationsSettings = lazy(() => import('./settings/IntegrationsSettings'));
const AppearanceSettings = lazy(() => import('./settings/AppearanceSettings'));

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
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Handle keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const input = document.querySelector(
          'input[placeholder="Search settings..."]'
        ) as HTMLInputElement;
        if (input && document.activeElement !== input) {
          e.preventDefault();
          input.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBack = () => {
    navigate(`/${tenant?.slug}/admin`);
  };

  const renderContent = () => {
    const props = { key: activeSection };

    switch (activeSection) {
      case 'account':
        return <AccountSettings {...props} />;
      case 'security':
        return <SecuritySettings {...props} />;
      case 'business':
        return <BusinessSettings {...props} />;
      case 'notifications':
        return <NotificationSettings {...props} />;
      case 'billing':
        return <BillingSettings {...props} />;
      case 'team':
        return <TeamSettings {...props} />;
      case 'integrations':
        return <IntegrationsSettings {...props} />;
      case 'appearance':
        return <AppearanceSettings {...props} />;
      default:
        return <AccountSettings {...props} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-background border-b px-4 py-3 flex items-center gap-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <SettingsSidebar
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              onBack={handleBack}
              isMobile
              onMobileClose={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-semibold capitalize">{activeSection} Settings</h1>
        </div>
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <SettingsSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            onBack={handleBack}
          />
        </div>

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 min-h-screen',
            'p-4 sm:p-6 lg:p-8 xl:p-12',
            'max-w-4xl'
          )}
        >
          <Suspense fallback={<SettingsLoadingFallback />}>
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {renderContent()}
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
