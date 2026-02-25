/**
 * Settings Hub Page
 * Consolidated settings with tabs:
 * - General: General settings
 * - Billing: Billing and subscription
 * - Integrations: API, webhooks, automation
 * - Security: Security settings
 * - Support: Help and support
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Settings,
    CreditCard,
    Plug,
    Shield,
    Headphones,
    ToggleRight,
} from 'lucide-react';
import { Fragment, lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { ScrollableTabsList } from '@/components/admin/ScrollableTabsList';
import { usePageTitle } from '@/hooks/usePageTitle';

const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));
const BillingPage = lazy(() => import('@/pages/tenant-admin/BillingPage'));
const APIAccessPage = lazy(() => import('@/pages/tenant-admin/APIAccessPage'));
const TenantSecuritySettings = lazy(() => import('@/components/admin/settings/TenantSecuritySettings'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));
const FeatureTogglesPanel = lazy(() => import('@/components/admin/settings/FeatureTogglesPanel').then(m => ({ default: m.FeatureTogglesPanel })));
const PaymentSettingsTab = lazy(() => import('@/components/admin/settings/PaymentSettingsTab'));

const TabSkeleton = () => (
    <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Configuration
    { id: 'general', label: 'General', icon: Settings, group: 'Configuration' },
    { id: 'features', label: 'Features', icon: ToggleRight, group: 'Configuration' },
    // Account
    { id: 'billing', label: 'Billing', icon: CreditCard, group: 'Account' },
    { id: 'payments', label: 'Payments', icon: CreditCard, group: 'Account' },
    { id: 'security', label: 'Security', icon: Shield, group: 'Account' },
    // Tools
    { id: 'integrations', label: 'Integrations', icon: Plug, group: 'Tools' },
    { id: 'support', label: 'Support', icon: Headphones, group: 'Tools' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function SettingsHubPage() {
    usePageTitle('Settings');
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'general';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
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
                                Manage your account and preferences
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

                <TabsContent value="general" className="m-0">
                    <ModuleErrorBoundary moduleName="General Settings">
                        <Suspense fallback={<TabSkeleton />}><SettingsPage embedded /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="features" className="m-0">
                    <ModuleErrorBoundary moduleName="Feature Toggles">
                        <Suspense fallback={<TabSkeleton />}>
                            <div className="p-2 sm:p-6">
                                <FeatureTogglesPanel />
                            </div>
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="billing" className="m-0">
                    <ModuleErrorBoundary moduleName="Billing">
                        <Suspense fallback={<TabSkeleton />}><BillingPage /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="payments" className="m-0">
                    <ModuleErrorBoundary moduleName="Payments">
                        <Suspense fallback={<TabSkeleton />}><PaymentSettingsTab /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="integrations" className="m-0">
                    <ModuleErrorBoundary moduleName="Integrations">
                        <Suspense fallback={<TabSkeleton />}><APIAccessPage /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="security" className="m-0">
                    <ModuleErrorBoundary moduleName="Security">
                        <Suspense fallback={<TabSkeleton />}><TenantSecuritySettings /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
                <TabsContent value="support" className="m-0">
                    <ModuleErrorBoundary moduleName="Support">
                        <Suspense fallback={<TabSkeleton />}><HelpPage /></Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
            </Tabs>
        </div>
    );
}
