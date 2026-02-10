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
    FileText,
    ArrowLeftRight,
    Users,
    UserCog,
    ScrollText,
    Shield,
    Calendar,
    Headphones,
    MapPin,
    Truck,
} from 'lucide-react';
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';

// Lazy load tab content for performance
const VendorOperationsPage = lazy(() => import('@/pages/admin/operations/VendorOperationsPage'));
const PurchaseOrdersPage = lazy(() => import('@/pages/admin/PurchaseOrdersPage'));
const ReturnsManagementPage = lazy(() => import('@/pages/admin/ReturnsManagementPage'));
const TeamManagement = lazy(() => import('@/pages/admin/TeamManagement'));
const RoleManagement = lazy(() => import('@/pages/admin/RoleManagement'));
const InvitesPage = lazy(() => import('@/pages/admin/InvitesPage'));
const ActivityLogsPage = lazy(() => import('@/pages/tenant-admin/ActivityLogsPage').then(m => ({ default: m.ActivityLogsPage })));
const QualityControlPage = lazy(() => import('@/pages/admin/QualityControlPage'));
const AppointmentSchedulerPage = lazy(() => import('@/pages/admin/AppointmentSchedulerPage'));
const SupportTicketsPage = lazy(() => import('@/pages/admin/SupportTicketsPage'));
const LocationsManagement = lazy(() => import('@/pages/admin/LocationsManagement'));
const CompliancePage = lazy(() => import('@/pages/tenant-admin/CompliancePage'));
const POReceivingPage = lazy(() => import('@/pages/admin/operations/POReceivingPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // People Management
    { id: 'team', label: 'Team', icon: Users, group: 'People' },
    { id: 'roles', label: 'Roles', icon: UserCog, group: 'People' },
    { id: 'invites', label: 'Invites', icon: Users, group: 'People' },
    // Supply Chain
    { id: 'suppliers', label: 'Vendors', icon: Building2, group: 'Supply' },
    { id: 'purchase-orders', label: 'POs', icon: FileText, group: 'Supply' },
    { id: 'receiving', label: 'Receiving', icon: Truck, group: 'Supply' },
    { id: 'returns', label: 'Returns', icon: ArrowLeftRight, group: 'Supply' },
    // Compliance & Quality
    { id: 'compliance', label: 'Compliance', icon: Shield, group: 'Compliance' },
    { id: 'quality', label: 'QC', icon: Shield, group: 'Compliance' },
    { id: 'activity', label: 'Logs', icon: ScrollText, group: 'Compliance' },
    // Facilities
    { id: 'locations', label: 'Locations', icon: MapPin, group: 'Facilities' },
    { id: 'appointments', label: 'Calendar', icon: Calendar, group: 'Facilities' },
    { id: 'support', label: 'Support', icon: Headphones, group: 'Facilities' },
] as const;

// Remove vault tab (consolidate into compliance) - reduces from 13 to 12

type TabId = typeof tabs[number]['id'];

export default function OperationsHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'team';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <HubBreadcrumbs
                        hubName="operations-hub"
                        hubHref="operations-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Operations</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage suppliers, team, locations, and daily operations
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                return (
                                    <>
                                        {showSeparator && (
                                            <div key={`sep-${index}`} className="w-px h-6 bg-border mx-1" />
                                        )}
                                        <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                            <tab.icon className="h-4 w-4" />
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </TabsTrigger>
                                    </>
                                );
                            })}
                        </TabsList>
                    </div>
                </div>

                {/* Vendors Tab */}
                <TabsContent value="suppliers" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <VendorOperationsPage />
                    </Suspense>
                </TabsContent>

                {/* Purchase Orders Tab */}
                <TabsContent value="purchase-orders" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <PurchaseOrdersPage />
                    </Suspense>
                </TabsContent>

                {/* Receiving Tab */}
                <TabsContent value="receiving" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <POReceivingPage />
                    </Suspense>
                </TabsContent>

                {/* Returns Tab */}
                <TabsContent value="returns" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <ReturnsManagementPage />
                    </Suspense>
                </TabsContent>

                {/* Team Tab */}
                <TabsContent value="team" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <TeamManagement />
                    </Suspense>
                </TabsContent>

                {/* Roles Tab */}
                <TabsContent value="roles" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <RoleManagement />
                    </Suspense>
                </TabsContent>

                {/* Invites Tab */}
                <TabsContent value="invites" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <InvitesPage />
                    </Suspense>
                </TabsContent>

                {/* Activity Tab */}
                <TabsContent value="activity" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <ActivityLogsPage />
                    </Suspense>
                </TabsContent>

                {/* Compliance Tab */}
                <TabsContent value="compliance" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CompliancePage />
                    </Suspense>
                </TabsContent>

                {/* Quality Tab */}
                <TabsContent value="quality" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <QualityControlPage />
                    </Suspense>
                </TabsContent>

                {/* Appointments Tab */}
                <TabsContent value="appointments" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <AppointmentSchedulerPage />
                    </Suspense>
                </TabsContent>

                {/* Support Tab */}
                <TabsContent value="support" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <SupportTicketsPage />
                    </Suspense>
                </TabsContent>

                {/* Locations Tab */}
                <TabsContent value="locations" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <LocationsManagement />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
