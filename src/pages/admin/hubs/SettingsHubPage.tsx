/**
 * Settings Hub Page
 * Consolidated settings management with tabs:
 * - Business: Business profile and general settings
 * - Team: User management and permissions
 * - Store: Store settings (tier-gated)
 * - Notifications: Notification preferences
 * - Integrations: API, webhooks, automation
 * - Billing: Subscription and payment
 *
 * Quick Links section provides access to:
 * - Business Profile, Team Management, Store Settings
 * - Notifications, Integrations, Billing
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Settings,
    CreditCard,
    Plug,
    Bell,
    Users,
    Store,
    Lock,
    Building,
    CheckCircle2,
} from 'lucide-react';
import { lazy, Suspense, Fragment, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { HubLinkCard, HubLinkGrid } from '@/components/admin/ui/HubLinkCard';
import { useSettingsHubCounts } from '@/hooks/useSettingsHubCounts';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Badge } from '@/components/ui/badge';

// Lazy load tab content for performance
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));
const BillingPage = lazy(() => import('@/pages/tenant-admin/BillingPage'));
const APIAccessPage = lazy(() => import('@/pages/tenant-admin/APIAccessPage'));
const TeamManagement = lazy(() => import('@/pages/admin/TeamManagement'));
const NotificationsPage = lazy(() => import('@/pages/admin/Notifications'));
const StorefrontSettings = lazy(() => import('@/pages/admin/storefront/StorefrontSettings'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Configuration
    { id: 'business', label: 'Business', icon: Building, group: 'Configuration' },
    { id: 'team', label: 'Team', icon: Users, group: 'Configuration', minTier: 'professional' as const },
    // Channels
    { id: 'store', label: 'Store', icon: Store, group: 'Channels', minTier: 'professional' as const },
    { id: 'notifications', label: 'Alerts', icon: Bell, group: 'Channels' },
    // Account
    { id: 'integrations', label: 'Integrations', icon: Plug, group: 'Account', minTier: 'enterprise' as const },
    { id: 'billing', label: 'Billing', icon: CreditCard, group: 'Account' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function SettingsHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'business';
    const { navigateToAdmin } = useTenantNavigation();
    const { counts, isLoading: countsLoading } = useSettingsHubCounts();
    const { canAccess, currentTier } = useFeatureAccess();

    // Check feature access for tier-gated settings
    const hasTeamAccess = canAccess('team-members');
    const hasStoreAccess = canAccess('storefront');
    const hasIntegrationsAccess = canAccess('api-access');

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

    // Calculate settings completion status
    const completionStatus = {
        business: counts.profileComplete,
        team: counts.teamMembers > 1,
        store: counts.storeConfigured,
        notifications: counts.notificationsEnabled,
        integrations: counts.integrationsConfigured > 0,
        billing: counts.billingConfigured,
    };

    const totalSections = 6;
    const completedSections = Object.values(completionStatus).filter(Boolean).length;

    return (
        <div className="min-h-dvh bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <HubBreadcrumbs
                        hubName="settings-hub"
                        hubHref="settings-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div>
                                <h1 className="text-2xl font-bold">Settings</h1>
                                <p className="text-muted-foreground text-sm">
                                    Manage your account, team, and preferences
                                </p>
                            </div>
                            <Badge variant="outline" className="ml-2">
                                {completedSections}/{totalSections} configured
                            </Badge>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                const isLocked = tab.minTier && !canAccess(
                                    tab.id === 'team' ? 'team-members' :
                                    tab.id === 'store' ? 'storefront' :
                                    tab.id === 'integrations' ? 'api-access' : 'settings'
                                );

                                return (
                                    <Fragment key={tab.id}>
                                        {showSeparator && (
                                            <div className="w-px h-6 bg-border mx-1" />
                                        )}
                                        <TabsTrigger
                                            value={tab.id}
                                            className="flex items-center gap-2"
                                            disabled={isLocked}
                                        >
                                            {isLocked ? (
                                                <Lock className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <tab.icon className="h-4 w-4" />
                                            )}
                                            <span className="hidden sm:inline">{tab.label}</span>
                                            {isLocked && (
                                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                                    ({tab.minTier})
                                                </span>
                                            )}
                                        </TabsTrigger>
                                    </Fragment>
                                );
                            })}
                        </TabsList>
                    </div>

                    {/* Quick Links Section */}
                    <div className="mt-4 pt-4 border-t">
                        <h2 className="text-sm font-medium text-muted-foreground mb-3">Quick Links</h2>
                        <HubLinkGrid>
                            <HubLinkCard
                                title="Business Profile"
                                description={counts.profileComplete ? 'Profile configured' : 'Set up your business info'}
                                icon={Building}
                                href="settings-hub?tab=business"
                                status={counts.profileComplete ? 'active' : 'pending'}
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Team Management"
                                description={hasTeamAccess ? `${counts.teamMembers} team members` : 'Upgrade to Professional'}
                                icon={hasTeamAccess ? Users : Lock}
                                href={hasTeamAccess ? 'settings-hub?tab=team' : 'billing'}
                                count={hasTeamAccess ? counts.teamMembers : undefined}
                                countLabel="users"
                                status={hasTeamAccess ? (counts.teamMembers > 1 ? 'active' : 'info') : 'pending'}
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Store Settings"
                                description={hasStoreAccess ? (counts.storeConfigured ? 'Store active' : 'Configure your storefront') : 'Upgrade to Professional'}
                                icon={hasStoreAccess ? Store : Lock}
                                href={hasStoreAccess ? 'settings-hub?tab=store' : 'billing'}
                                status={hasStoreAccess ? (counts.storeConfigured ? 'active' : 'info') : 'pending'}
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Notifications"
                                description={counts.notificationsEnabled ? 'Alerts enabled' : 'Configure notifications'}
                                icon={Bell}
                                href="settings-hub?tab=notifications"
                                status={counts.notificationsEnabled ? 'active' : 'info'}
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Integrations"
                                description={hasIntegrationsAccess ? `${counts.integrationsConfigured}/${counts.totalIntegrations} connected` : 'Upgrade to Enterprise'}
                                icon={hasIntegrationsAccess ? Plug : Lock}
                                href={hasIntegrationsAccess ? 'settings-hub?tab=integrations' : 'billing'}
                                count={hasIntegrationsAccess ? counts.integrationsConfigured : undefined}
                                countLabel="active"
                                status={hasIntegrationsAccess ? (counts.integrationsConfigured > 0 ? 'active' : 'info') : 'pending'}
                                isLoading={countsLoading}
                            />
                            <HubLinkCard
                                title="Billing"
                                description={counts.billingConfigured ? 'Payment method on file' : 'Add payment method'}
                                icon={CreditCard}
                                href="settings-hub?tab=billing"
                                status={counts.billingConfigured ? 'active' : 'warning'}
                                isLoading={countsLoading}
                            />
                        </HubLinkGrid>
                    </div>
                </div>

                {/* Business Settings Tab */}
                <TabsContent value="business" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <SettingsPage />
                    </Suspense>
                </TabsContent>

                {/* Team Management Tab */}
                <TabsContent value="team" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        {hasTeamAccess ? (
                            <TeamManagement />
                        ) : (
                            <LockedFeatureMessage
                                feature="Team Management"
                                tier="Professional"
                                onUpgrade={() => navigateToAdmin('billing')}
                            />
                        )}
                    </Suspense>
                </TabsContent>

                {/* Store Settings Tab */}
                <TabsContent value="store" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        {hasStoreAccess ? (
                            <StorefrontSettings />
                        ) : (
                            <LockedFeatureMessage
                                feature="Store Settings"
                                tier="Professional"
                                onUpgrade={() => navigateToAdmin('billing')}
                            />
                        )}
                    </Suspense>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <NotificationsPage />
                    </Suspense>
                </TabsContent>

                {/* Integrations Tab */}
                <TabsContent value="integrations" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        {hasIntegrationsAccess ? (
                            <APIAccessPage />
                        ) : (
                            <LockedFeatureMessage
                                feature="API & Integrations"
                                tier="Enterprise"
                                onUpgrade={() => navigateToAdmin('billing')}
                            />
                        )}
                    </Suspense>
                </TabsContent>

                {/* Billing Tab */}
                <TabsContent value="billing" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <BillingPage />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Locked Feature Message Component
interface LockedFeatureMessageProps {
    feature: string;
    tier: string;
    onUpgrade: () => void;
}

function LockedFeatureMessage({ feature, tier, onUpgrade }: LockedFeatureMessageProps) {
    return (
        <div className="container mx-auto p-6">
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                    <Lock className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{feature} is a {tier} Feature</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                    Upgrade to the {tier} plan to unlock {feature.toLowerCase()} and other powerful features.
                </p>
                <button
                    onClick={onUpgrade}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                    View Upgrade Options
                </button>
            </div>
        </div>
    );
}
