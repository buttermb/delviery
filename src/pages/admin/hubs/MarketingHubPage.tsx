/**
 * Marketing Hub Page
 * Consolidated marketing page with tabs:
 * - Loyalty: Loyalty program management
 * - Coupons: Coupon management
 * - Campaigns: Marketing automation and campaigns
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Star,
    Tag,
    Mail,
    MessageSquare,
    ThumbsUp,
} from 'lucide-react';
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { usePageTitle } from '@/hooks/usePageTitle';

// Lazy load tab content for performance
const LoyaltyProgramPage = lazy(() => import('@/pages/admin/LoyaltyProgramPage'));
const CouponManagementPage = lazy(() => import('@/pages/admin/CouponManagementPage'));
const MarketingAutomationPage = lazy(() => import('@/pages/admin/MarketingAutomationPage'));
const AdminLiveChat = lazy(() => import('@/pages/admin/AdminLiveChat'));
const ReviewsPage = lazy(() => import('@/pages/admin/ReviewsPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Customer Retention
    { id: 'loyalty', label: 'Loyalty', icon: Star, group: 'Retention' },
    { id: 'coupons', label: 'Coupons', icon: Tag, group: 'Retention' },
    { id: 'reviews', label: 'Reviews', icon: ThumbsUp, group: 'Retention' },
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
                    <div className="overflow-x-auto">
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
                    </div>
                </div>

                {/* Tab Content - Scrollable */}
                <div className="flex-1 min-h-0 overflow-auto">
                    {/* Loyalty Tab */}
                    <TabsContent value="loyalty" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}>
                            <LoyaltyProgramPage />
                        </Suspense>
                    </TabsContent>

                    {/* Coupons Tab */}
                    <TabsContent value="coupons" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}>
                            <CouponManagementPage />
                        </Suspense>
                    </TabsContent>

                    {/* Reviews Tab */}
                    <TabsContent value="reviews" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}>
                            <ReviewsPage />
                        </Suspense>
                    </TabsContent>

                    {/* Campaigns Tab */}
                    <TabsContent value="campaigns" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}>
                            <MarketingAutomationPage />
                        </Suspense>
                    </TabsContent>

                    {/* Live Chat Tab */}
                    <TabsContent value="live-chat" className="m-0 h-full">
                        <Suspense fallback={<TabSkeleton />}>
                            <AdminLiveChat />
                        </Suspense>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
