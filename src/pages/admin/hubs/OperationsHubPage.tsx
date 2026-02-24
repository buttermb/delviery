/**
 * Operations Hub Page
 * Consolidated operations page with 8 top-level tabs:
 * - Team (sub-tabs: Members, Roles, Invites)
 * - Procurement (sub-tabs: Vendors, POs, Receiving)
 * - Returns: Returns and refunds
 * - Compliance: Regulatory compliance
 * - Quality: Quality control
 * - Logs: Activity logs
 * - Locations: Location management
 * - Calendar: Scheduling
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
    ClipboardCheck,
    Calendar,
    MapPin,
    Truck,
    Mail,
    UserPlus,
    Package,
} from 'lucide-react';
import { Fragment, lazy, Suspense, useCallback, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { ScrollableTabsList } from '@/components/admin/ScrollableTabsList';
import { usePageTitle } from '@/hooks/usePageTitle';

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
const LocationsManagement = lazy(() => import('@/pages/admin/LocationsManagement'));
const CompliancePage = lazy(() => import('@/pages/tenant-admin/CompliancePage'));
const POReceivingPage = lazy(() => import('@/pages/admin/operations/POReceivingPage'));

const TabSkeleton = () => (
    <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    { id: 'team', label: 'Team', icon: Users, group: 'People' },
    { id: 'procurement', label: 'Procurement', icon: Package, group: 'Supply' },
    { id: 'returns', label: 'Returns', icon: ArrowLeftRight, group: 'Supply' },
    { id: 'compliance', label: 'Compliance', icon: Shield, group: 'Compliance' },
    { id: 'quality', label: 'Quality', tooltip: 'Quality Control', icon: ClipboardCheck, group: 'Compliance' },
    { id: 'activity', label: 'Logs', tooltip: 'Activity Logs', icon: ScrollText, group: 'Compliance' },
    { id: 'locations', label: 'Locations', icon: MapPin, group: 'Facilities' },
    { id: 'appointments', label: 'Calendar', icon: Calendar, group: 'Facilities' },
] as const;

type TabId = typeof tabs[number]['id'];

// Map legacy tab IDs to new grouped structure for backward compatibility
const legacyTabMap: Record<string, { tab: TabId; sub?: string }> = {
    roles: { tab: 'team', sub: 'roles' },
    invites: { tab: 'team', sub: 'invites' },
    suppliers: { tab: 'procurement', sub: 'vendors' },
    'purchase-orders': { tab: 'procurement', sub: 'purchase-orders' },
    receiving: { tab: 'procurement', sub: 'receiving' },
};

const teamSubTabs = [
    { id: 'members', label: 'Members', icon: Users },
    { id: 'roles', label: 'Roles', icon: UserCog },
    { id: 'invites', label: 'Invites', icon: Mail },
] as const;

const procurementSubTabs = [
    { id: 'vendors', label: 'Vendors', icon: Building2 },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText },
    { id: 'receiving', label: 'Receiving', icon: Truck },
] as const;

export default function OperationsHubPage() {
    usePageTitle('Operations');
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab') || 'team';
    const rawSub = searchParams.get('sub') ?? '';

    // Redirect legacy tab IDs to new structure
    useEffect(() => {
        const legacy = legacyTabMap[rawTab];
        if (legacy) {
            const params: Record<string, string> = { tab: legacy.tab };
            if (legacy.sub) params.sub = legacy.sub;
            setSearchParams(params, { replace: true });
        }
    }, [rawTab, setSearchParams]);

    const activeTab = (legacyTabMap[rawTab]?.tab ?? rawTab) as TabId;
    const activeSub = legacyTabMap[rawTab]?.sub ?? rawSub;

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    const handleSubTabChange = useCallback((tab: string, sub: string) => {
        setSearchParams({ tab, sub }, { replace: true });
    }, [setSearchParams]);

    const activeTabLabel = (() => {
        const topTab = tabs.find(t => t.id === activeTab);
        if (!topTab) return undefined;
        if (activeTab === 'team' && activeSub) {
            const subTab = teamSubTabs.find(s => s.id === activeSub);
            return subTab ? `${topTab.label} / ${subTab.label}` : topTab.label;
        }
        if (activeTab === 'procurement' && activeSub) {
            const subTab = procurementSubTabs.find(s => s.id === activeSub);
            return subTab ? `${topTab.label} / ${subTab.label}` : topTab.label;
        }
        return topTab.label;
    })();

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-6 py-4">
                    <HubBreadcrumbs
                        hubName="operations-hub"
                        hubHref="operations-hub"
                        currentTab={activeTabLabel}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Operations</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage suppliers, team, locations, and daily operations
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => handleSubTabChange('team', 'invites')}
                        >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Invite Member
                        </Button>
                    </div>
                    <ScrollableTabsList>
                        <TooltipProvider delayDuration={300}>
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab, index) => {
                                const prevTab = index > 0 ? tabs[index - 1] : null;
                                const showSeparator = prevTab && prevTab.group !== tab.group;
                                const trigger = (
                                    <TabsTrigger value={tab.id} className="flex items-center gap-2">
                                        <tab.icon className="h-4 w-4" />
                                        <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                                    </TabsTrigger>
                                );
                                return (
                                    <Fragment key={tab.id}>
                                        {showSeparator && (
                                            <div className="w-px h-6 bg-border mx-1" />
                                        )}
                                        {'tooltip' in tab && tab.tooltip ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                                                <TooltipContent>{tab.tooltip}</TooltipContent>
                                            </Tooltip>
                                        ) : trigger}
                                    </Fragment>
                                );
                            })}
                        </TabsList>
                        </TooltipProvider>
                    </ScrollableTabsList>
                </div>

                {/* Team Tab (grouped: Members, Roles, Invites) */}
                <TabsContent value="team" className="m-0">
                    <Tabs
                        value={activeSub || 'members'}
                        onValueChange={(sub) => handleSubTabChange('team', sub)}
                        className="w-full"
                    >
                        <div className="border-b px-6 pt-2">
                            <TabsList className="h-9 bg-transparent gap-1">
                                {teamSubTabs.map((sub) => (
                                    <TabsTrigger
                                        key={sub.id}
                                        value={sub.id}
                                        className="flex items-center gap-1.5 text-xs data-[state=active]:bg-muted"
                                    >
                                        <sub.icon className="h-3.5 w-3.5" />
                                        {sub.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>
                        <TabsContent value="members" className="m-0">
                            <ModuleErrorBoundary moduleName="Team Members">
                                <Suspense fallback={<TabSkeleton />}>
                                    <TeamManagement />
                                </Suspense>
                            </ModuleErrorBoundary>
                        </TabsContent>
                        <TabsContent value="roles" className="m-0">
                            <ModuleErrorBoundary moduleName="Role Management">
                                <Suspense fallback={<TabSkeleton />}>
                                    <RoleManagement />
                                </Suspense>
                            </ModuleErrorBoundary>
                        </TabsContent>
                        <TabsContent value="invites" className="m-0">
                            <ModuleErrorBoundary moduleName="Invites">
                                <Suspense fallback={<TabSkeleton />}>
                                    <InvitesPage />
                                </Suspense>
                            </ModuleErrorBoundary>
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                {/* Procurement Tab (grouped: Vendors, POs, Receiving) */}
                <TabsContent value="procurement" className="m-0">
                    <Tabs
                        value={activeSub || 'vendors'}
                        onValueChange={(sub) => handleSubTabChange('procurement', sub)}
                        className="w-full"
                    >
                        <div className="border-b px-6 pt-2">
                            <TabsList className="h-9 bg-transparent gap-1">
                                {procurementSubTabs.map((sub) => (
                                    <TabsTrigger
                                        key={sub.id}
                                        value={sub.id}
                                        className="flex items-center gap-1.5 text-xs data-[state=active]:bg-muted"
                                    >
                                        <sub.icon className="h-3.5 w-3.5" />
                                        {sub.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>
                        <TabsContent value="vendors" className="m-0">
                            <ModuleErrorBoundary moduleName="Vendors">
                                <Suspense fallback={<TabSkeleton />}>
                                    <VendorOperationsPage />
                                </Suspense>
                            </ModuleErrorBoundary>
                        </TabsContent>
                        <TabsContent value="purchase-orders" className="m-0">
                            <ModuleErrorBoundary moduleName="Purchase Orders">
                                <Suspense fallback={<TabSkeleton />}>
                                    <PurchaseOrdersPage />
                                </Suspense>
                            </ModuleErrorBoundary>
                        </TabsContent>
                        <TabsContent value="receiving" className="m-0">
                            <ModuleErrorBoundary moduleName="Receiving">
                                <Suspense fallback={<TabSkeleton />}>
                                    <POReceivingPage />
                                </Suspense>
                            </ModuleErrorBoundary>
                        </TabsContent>
                    </Tabs>
                </TabsContent>

                {/* Returns Tab */}
                <TabsContent value="returns" className="m-0">
                    <ModuleErrorBoundary moduleName="Returns">
                        <Suspense fallback={<TabSkeleton />}>
                            <ReturnsManagementPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Compliance Tab */}
                <TabsContent value="compliance" className="m-0">
                    <ModuleErrorBoundary moduleName="Compliance">
                        <Suspense fallback={<TabSkeleton />}>
                            <CompliancePage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Quality Tab */}
                <TabsContent value="quality" className="m-0">
                    <ModuleErrorBoundary moduleName="Quality Control">
                        <Suspense fallback={<TabSkeleton />}>
                            <QualityControlPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Activity/Logs Tab */}
                <TabsContent value="activity" className="m-0">
                    <ModuleErrorBoundary moduleName="Activity Logs">
                        <Suspense fallback={<TabSkeleton />}>
                            <ActivityLogsPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Locations Tab */}
                <TabsContent value="locations" className="m-0">
                    <ModuleErrorBoundary moduleName="Locations">
                        <Suspense fallback={<TabSkeleton />}>
                            <LocationsManagement />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Calendar/Appointments Tab */}
                <TabsContent value="appointments" className="m-0">
                    <ModuleErrorBoundary moduleName="Calendar">
                        <Suspense fallback={<TabSkeleton />}>
                            <AppointmentSchedulerPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
            </Tabs>
        </div>
    );
}
