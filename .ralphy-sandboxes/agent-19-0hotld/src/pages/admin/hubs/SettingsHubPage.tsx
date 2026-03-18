/**
 * Settings Hub Page
 * Consolidated settings with tabs:
 * - Account: Profile, name, email, avatar
 * - Business: Company details, hours, branding
 * - Team: RBAC, invitations, roles
 * - Security: Password, 2FA, sessions
 * - Payments: Payment methods & crypto
 * - Billing: Plan, invoices, usage
 * - Notifications: Alert preferences
 * - Integrations: APIs, webhooks, services
 * - Appearance: Theme, font, sidebar
 * - CRM: Invoice, tax, payment terms
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    User,
    Building2,
    Users,
    Shield,
    CreditCard,
    Receipt,
    Bell,
    Plug,
    Palette,
    BadgeDollarSign,
} from 'lucide-react';
import { Fragment, lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { ScrollableTabsList } from '@/components/admin/ScrollableTabsList';
import { usePageTitle } from '@/hooks/usePageTitle';

// Lazy-loaded setting pages (all pre-built)
const AccountSettings = lazy(() => import('@/pages/tenant-admin/settings/AccountSettings'));
const BusinessSettings = lazy(() => import('@/pages/tenant-admin/settings/BusinessSettings'));
const TeamSettings = lazy(() => import('@/pages/tenant-admin/settings/TeamSettings'));
const SecuritySettings = lazy(() => import('@/pages/tenant-admin/settings/SecuritySettings'));
const PaymentSettingsTab = lazy(() => import('@/components/admin/settings/PaymentSettingsTab'));
const BillingSettings = lazy(() => import('@/pages/tenant-admin/settings/BillingSettings'));
const NotificationSettings = lazy(() => import('@/pages/tenant-admin/settings/NotificationSettings'));
const IntegrationsSettings = lazy(() => import('@/pages/tenant-admin/settings/IntegrationsSettings'));
const AppearanceSettings = lazy(() => import('@/pages/tenant-admin/settings/AppearanceSettings'));
const CRMSettingsPage = lazy(() => import('@/pages/admin/CRMSettingsPage'));

const TabSkeleton = () => (
    <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Profile & Company
    { id: 'account', label: 'Account', icon: User, group: 'Profile' },
    { id: 'business', label: 'Business', icon: Building2, group: 'Profile' },
    { id: 'team', label: 'Team', icon: Users, group: 'Profile' },
    // Security & Payments
    { id: 'security', label: 'Security', icon: Shield, group: 'Money' },
    { id: 'payments', label: 'Payments', icon: CreditCard, group: 'Money' },
    { id: 'billing', label: 'Billing', icon: Receipt, group: 'Money' },
    // Configuration
    { id: 'notifications', label: 'Notifications', icon: Bell, group: 'Config' },
    { id: 'integrations', label: 'Integrations', icon: Plug, group: 'Config' },
    { id: 'appearance', label: 'Appearance', icon: Palette, group: 'Config' },
    { id: 'crm', label: 'CRM', icon: BadgeDollarSign, group: 'Config' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function SettingsHubPage() {
    usePageTitle('Settings');
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'account';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
        // Prevent auto-scroll jump caused by lazy-loaded component mounts inside TabsContent
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }, 0);
    }, [setSearchParams]);

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="border-b bg-card px-6 py-4">
                    <HubBreadcrumbs
                        hubName="settings-hub"
                        hubHref="settings-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Settings</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage your account, team, and preferences
                            </p>
                        </div>
                    </div>
                    <ScrollableTabsList>
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                return (
                                    <Fragment key={tab.id}>
                                        {showSeparator && (
                                            <div className="w-px h-6 bg-border mx-1" />
                                        )}
                                        <TabsTrigger value={tab.id} className="flex items-center gap-2">
                                            <tab.icon className="h-4 w-4" />
                                            <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                                        </TabsTrigger>
                                    </Fragment>
                                );
                            })}
                        </TabsList>
                    </ScrollableTabsList>
                </div>

                {/* Profile & Company */}
                <TabsContent value="account" className="m-0">
                    <ModuleErrorBoundary moduleName="Account">
                        <Suspense fallback={<TabSkeleton />}><AccountSettings /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="business" className="m-0">
                    <ModuleErrorBoundary moduleName="Business">
                        <Suspense fallback={<TabSkeleton />}><BusinessSettings /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="team" className="m-0">
                    <ModuleErrorBoundary moduleName="Team">
                        <Suspense fallback={<TabSkeleton />}><TeamSettings /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Security & Payments */}
                <TabsContent value="security" className="m-0">
                    <ModuleErrorBoundary moduleName="Security">
                        <Suspense fallback={<TabSkeleton />}><SecuritySettings /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="payments" className="m-0">
                    <ModuleErrorBoundary moduleName="Payments">
                        <Suspense fallback={<TabSkeleton />}><PaymentSettingsTab /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="billing" className="m-0">
                    <ModuleErrorBoundary moduleName="Billing">
                        <Suspense fallback={<TabSkeleton />}><BillingSettings /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Configuration */}
                <TabsContent value="notifications" className="m-0">
                    <ModuleErrorBoundary moduleName="Notifications">
                        <Suspense fallback={<TabSkeleton />}><NotificationSettings /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="integrations" className="m-0">
                    <ModuleErrorBoundary moduleName="Integrations">
                        <Suspense fallback={<TabSkeleton />}><IntegrationsSettings /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="appearance" className="m-0">
                    <ModuleErrorBoundary moduleName="Appearance">
                        <Suspense fallback={<TabSkeleton />}><AppearanceSettings /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="crm" className="m-0">
                    <ModuleErrorBoundary moduleName="CRM">
                        <Suspense fallback={<TabSkeleton />}><CRMSettingsPage /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
            </Tabs>
        </div>
    );
}
