/**
 * POS Hub Page
 * Consolidated Point of Sale page with tabs:
 * - Register: Main POS terminal
 * - Shifts: Shift management
 * - Z-Reports: End of day reports
 */

import { useState, useEffect, useCallback } from 'react';
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

const POSAnalyticsPage = lazy(() => import('@/pages/tenant-admin/POSAnalyticsPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
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
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'register';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

    // Keyboard shortcuts for quick tab switching (1-4)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
        <div className="min-h-screen bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Tab Header - Only show when NOT on register (register is fullscreen) */}
                {activeTab !== 'register' && (
                    <div className="border-b bg-card px-4 py-3">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h1 className="text-2xl font-bold">Point of Sale</h1>
                                <p className="text-muted-foreground text-sm">
                                    Cash register, shifts, and end-of-day reports
                                </p>
                            </div>
                        </div>
                        <TabsList className="grid w-full max-w-lg grid-cols-4">
                            {tabs.map((tab) => (
                                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                    <tab.icon className="h-4 w-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                )}

                {/* Register Tab - Full screen POS */}
                <TabsContent value="register" className="m-0">
                    {/* Show mini tab switcher in corner for register view with keyboard hints */}
                    <div className="fixed bottom-4 right-4 z-50 bg-card rounded-lg shadow-lg border p-2 flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground px-2 pb-1 border-b mb-1">Quick Nav (1-4)</span>
                        {tabs.map((tab, index) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors ${activeTab === tab.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted text-foreground'
                                    }`}
                            >
                                <kbd className="text-xs opacity-60 font-mono w-4">{index + 1}</kbd>
                                <tab.icon className="h-4 w-4" />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                    <PointOfSale />
                </TabsContent>

                {/* Shifts Tab */}
                <TabsContent value="shifts" className="m-0">
                    <div className="p-6">
                        <ShiftManager />
                    </div>
                </TabsContent>

                {/* Z-Reports Tab */}
                <TabsContent value="z-reports" className="m-0">
                    <ZReportContent />
                </TabsContent>

                {/* Analytics Tab */}
                <TabsContent value="analytics" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <POSAnalyticsPage />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
