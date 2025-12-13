/**
 * Operations Hub Page
 * Consolidated operations page with tabs:
 * - Suppliers: Supplier management
 * - Purchase Orders: PO management
 * - Returns: Returns and refunds
 * - Team: Staff/team management
 * - Roles: Role management
 * - Activity: Activity logs
 * - Quality: Quality control
 * - Appointments: Scheduling
 * - Support: Support tickets
 * - Locations: Location management
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Building2,
    Users,
    MapPin,
    Truck,
    Shield,
} from 'lucide-react';
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load tab content for performance
const TeamManagement = lazy(() => import('@/pages/admin/TeamManagement'));
const SupplierManagementPage = lazy(() => import('@/pages/admin/SupplierManagementPage'));
const LocationsManagement = lazy(() => import('@/pages/admin/LocationsManagement'));
const DeliveryManagement = lazy(() => import('@/pages/admin/DeliveryManagement'));
const CompliancePage = lazy(() => import('@/pages/tenant-admin/CompliancePage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    { id: 'team', label: 'Team', icon: Users },
    { id: 'vendors', label: 'Vendors', icon: Building2 },
    { id: 'locations', label: 'Locations', icon: MapPin },
    { id: 'delivery', label: 'Delivery', icon: Truck },
    { id: 'compliance', label: 'Compliance', icon: Shield },
] as const;

type TabId = typeof tabs[number]['id'];

export default function OperationsHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'team';

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
                            <h1 className="text-2xl font-bold">Operations</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage suppliers, team, locations, and daily operations
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

                {/* Team Tab */}
                <TabsContent value="team" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <TeamManagement />
                    </Suspense>
                </TabsContent>

                {/* Vendors Tab */}
                <TabsContent value="vendors" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <SupplierManagementPage />
                    </Suspense>
                </TabsContent>

                {/* Locations Tab */}
                <TabsContent value="locations" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <LocationsManagement />
                    </Suspense>
                </TabsContent>

                {/* Delivery Tab */}
                <TabsContent value="delivery" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <DeliveryManagement />
                    </Suspense>
                </TabsContent>

                {/* Compliance Tab */}
                <TabsContent value="compliance" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CompliancePage />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
