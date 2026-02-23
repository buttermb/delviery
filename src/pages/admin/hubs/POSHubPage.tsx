/**
 * POS Hub Page
 * Consolidated Point of Sale page with tabs:
 * - Register: Main POS terminal
 * - Shifts: Shift management
 * - Z-Reports: End of day reports
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Clock, FileText, BarChart3 } from 'lucide-react';

// Import existing components (reuse, don't duplicate)
import PointOfSale from '@/pages/admin/PointOfSale';
import { ShiftManager } from '@/components/pos/ShiftManager';
import ZReportContent from './panels/ZReportPanel';

// Lazy load for performance
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';
import { usePageTitle } from '@/hooks/usePageTitle';

const POSAnalyticsPage = lazy(() => import('@/pages/tenant-admin/POSAnalyticsPage'));

const TabSkeleton = () => (
    <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Core POS
    { id: 'register', label: 'Register', icon: CreditCard, group: 'POS' },
    // Shift Management
    { id: 'shifts', label: 'Shifts', icon: Clock, group: 'Management' },
    { id: 'z-reports', label: 'Z-Reports', icon: FileText, group: 'Management' },
    // Analytics
    { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Analytics' },
] as const;

type TabId = typeof tabs[number]['id'];

export default function POSHubPage() {
    usePageTitle('Point of Sale');
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'register';
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    // Keyboard shortcuts for quick tab switching (1-4), scoped to POS hub only
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;

            // Don't trigger if user is typing in an input or editable element
            if (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                target.isContentEditable
            ) {
                return;
            }

            // Don't trigger if a dialog, modal, or command palette is open
            if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-state="open"][role="dialog"]')) {
                return;
            }

            // Don't trigger if focus is outside the POS hub container (unless on body)
            if (
                containerRef.current &&
                target !== document.body &&
                !containerRef.current.contains(target)
            ) {
                return;
            }

            const key = e.key;
            if (key === '1') handleTabChange('register');
            else if (key === '2') handleTabChange('shifts');
            else if (key === '3') handleTabChange('z-reports');
            else if (key === '4') handleTabChange('analytics');
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleTabChange]);

    return (
        <div ref={containerRef} className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="border-b bg-card px-6 py-3">
                    {/* Hide breadcrumbs and title on register tab for fullscreen feel */}
                    {activeTab !== 'register' && (
                        <>
                            <HubBreadcrumbs
                                hubName="pos-system"
                                hubHref="pos-system"
                                currentTab={tabs.find(t => t.id === activeTab)?.label}
                            />
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <div>
                                    <h1 className="text-2xl font-bold">Point of Sale</h1>
                                    <p className="text-muted-foreground text-sm">
                                        Cash register, shifts, and end-of-day reports
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                    {/* Tab bar always visible so user can switch tabs */}
                    <TabsList className="flex w-full overflow-x-auto max-w-lg">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                <tab.icon className="h-4 w-4" />
                                <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {/* Register Tab - Full screen POS */}
                <TabsContent value="register" className="m-0">
                    <ModuleErrorBoundary moduleName="Cash Register">
                        <PointOfSale />
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Shifts Tab */}
                <TabsContent value="shifts" className="m-0">
                    <ModuleErrorBoundary moduleName="Shift Management">
                        <div className="p-6">
                            <ShiftManager />
                        </div>
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Z-Reports Tab */}
                <TabsContent value="z-reports" className="m-0">
                    <ModuleErrorBoundary moduleName="Z-Reports">
                        <ZReportContent />
                    </ModuleErrorBoundary>
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="m-0">
                    <ModuleErrorBoundary moduleName="POS Analytics">
                        <Suspense fallback={<TabSkeleton />}>
                            <POSAnalyticsPage />
                        </Suspense>
                    </ModuleErrorBoundary>
                </TabsContent>
            </Tabs>
        </div>
    );
}
