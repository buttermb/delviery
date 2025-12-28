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
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'loyalty';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

    return (
        <div className="min-h-screen bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header - Sticky Tabs */}
                <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm px-4 pt-4 pb-0">
                    <HubBreadcrumbs
                        hubName="marketing-hub"
                        hubHref="marketing-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="overflow-x-auto pb-4 scrollbar-hide">
                        <TabsList className="inline-flex min-w-max gap-1 bg-transparent p-0">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                return (
                                    <div key={tab.id} className="flex items-center">
                                        {showSeparator && (
                                            <div key={`sep-${index}`} className="w-px h-6 bg-border mx-2" />
                                        )}
                                        <TabsTrigger
                                            value={tab.id}
                                            className="flex items-center gap-2 rounded-full border border-transparent px-4 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/20 transition-all hover:bg-muted"
                                        >
                                            <tab.icon className="h-4 w-4" />
                                            <span className="hidden sm:inline font-medium">{tab.label}</span>
                                        </TabsTrigger>
                                    </div>
                                );
                            })}
                        </TabsList>
                    </div>
                </div>

                {/* Loyalty Tab */}
                <TabsContent value="loyalty" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <LoyaltyProgramPage />
                    </Suspense>
                </TabsContent>

                {/* Coupons Tab */}
                <TabsContent value="coupons" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CouponManagementPage />
                    </Suspense>
                </TabsContent>

                {/* Reviews Tab */}
                <TabsContent value="reviews" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <ReviewsPage />
                    </Suspense>
                </TabsContent>

                {/* Campaigns Tab */}
                <TabsContent value="campaigns" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <MarketingAutomationPage />
                    </Suspense>
                </TabsContent>

                {/* Live Chat Tab */}
                <TabsContent value="live-chat" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <AdminLiveChat />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
