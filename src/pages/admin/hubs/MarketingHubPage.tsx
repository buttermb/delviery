/**
 * Marketing Hub Page
 * Outreach & retention tools:
 * - Loyalty: Loyalty program management
 * - Campaigns: Marketing automation and campaigns
 * - Chat: Live customer chat
 *
 * Note: Coupons and Reviews live in Storefront Hub under the Marketing group.
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Star,
    Mail,
    MessageSquare,
} from 'lucide-react';
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { ScrollableTabsList } from '@/components/admin/ScrollableTabsList';
import { usePageTitle } from '@/hooks/usePageTitle';

// Lazy load tab content for performance
const LoyaltyProgramPage = lazy(() => import('@/pages/admin/LoyaltyProgramPage'));
const MarketingAutomationPage = lazy(() => import('@/pages/admin/MarketingAutomationPage'));
const AdminLiveChat = lazy(() => import('@/pages/admin/AdminLiveChat'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Customer Retention
    { id: 'loyalty', label: 'Loyalty', icon: Star, group: 'Retention' },
    // Outreach
    { id: 'campaigns', label: 'Campaigns', icon: Mail, group: 'Outreach' },
    { id: 'live-chat', label: 'Chat', icon: MessageSquare, group: 'Outreach' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function MarketingHubPage() {
    usePageTitle('Marketing');
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'loyalty';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    return (
        <div className="min-h-0 bg-background flex flex-col -m-4 sm:-m-6" style={{ height: 'calc(100vh - 56px)' }}>
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 min-h-0 flex flex-col">
                {/* Header - Fixed Tabs */}
                <div className="border-b bg-card px-6 py-4 shrink-0">
                    <HubBreadcrumbs
                        hubName="marketing-hub"
                        hubHref="marketing-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="mb-4">
                        <h1 className="text-2xl font-bold">Marketing</h1>
                        <p className="text-muted-foreground text-sm">
                            Loyalty programs, campaigns, and customer outreach. For coupons and reviews, see Storefront Hub.
                        </p>
                    </div>
                    <ScrollableTabsList>
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                return (
                                    <div key={tab.id} className="flex items-center">
                                        {showSeparator && (
                                            <div key={`sep-${index}`} className="w-px h-6 bg-border mx-1" />
                                        )}
                                        <TabsTrigger
                                            value={tab.id}
                                            className="flex items-center gap-2"
                                        >
                                            <tab.icon className="h-4 w-4" />
                                            <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                                        </TabsTrigger>
                                    </div>
                                );
                            })}
                        </TabsList>
                    </ScrollableTabsList>
                </div>

                {/* Tab Content - Scrollable */}
                <div className="flex-1 min-h-0 overflow-auto">
                    {/* Loyalty Tab */}
                    <TabsContent value="loyalty" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Loyalty Program">
                            <Suspense fallback={<TabSkeleton />}>
                                <LoyaltyProgramPage />
                            </Suspense>
                        </ModuleErrorBoundary>
                    </TabsContent>

                    {/* Campaigns Tab */}
                    <TabsContent value="campaigns" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Campaigns">
                            <Suspense fallback={<TabSkeleton />}>
                                <MarketingAutomationPage />
                            </Suspense>
                        </ModuleErrorBoundary>
                    </TabsContent>

                    {/* Live Chat Tab */}
                    <TabsContent value="live-chat" className="m-0 h-full">
                        <ModuleErrorBoundary moduleName="Live Chat">
                            <Suspense fallback={<TabSkeleton />}>
                                <AdminLiveChat />
                            </Suspense>
                        </ModuleErrorBoundary>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
