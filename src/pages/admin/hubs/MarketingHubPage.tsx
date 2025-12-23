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
    { id: 'loyalty', label: 'Loyalty', icon: Star },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'reviews', label: 'Reviews', icon: ThumbsUp },
    // Outreach
    { id: 'campaigns', label: 'Campaigns', icon: Mail },
    { id: 'live-chat', label: 'Chat', icon: MessageSquare },
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
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Marketing</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage loyalty programs, coupons, and marketing campaigns
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <TabsList className="inline-flex min-w-max">
                            {tabs.map((tab) => (
                                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                    <tab.icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </TabsTrigger>
                            ))}
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
