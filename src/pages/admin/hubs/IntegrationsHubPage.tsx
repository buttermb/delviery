/**
 * Integrations Hub Page
 * Consolidated integrations with tabs:
 * - API: API key management
 * - Webhooks: Webhook configuration
 * - Automation: Workflow automation
 * - Bulk Ops: Bulk operations
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Key,
    Webhook,
    Workflow,
    Database,
    Plug,
    Brain,
    Wrench,
} from 'lucide-react';
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { HubBreadcrumbs } from '@/components/admin/HubBreadcrumbs';

const APIAccessPage = lazy(() => import('@/pages/tenant-admin/APIAccessPage'));
const WebhooksPage = lazy(() => import('@/pages/tenant-admin/WebhooksPage'));
const AutomationPage = lazy(() => import('@/pages/tenant-admin/AutomationPage'));
const BulkOperationsPage = lazy(() => import('@/pages/tenant-admin/BulkOperationsPage'));
const CustomIntegrationsPage = lazy(() => import('@/pages/tenant-admin/CustomIntegrationsPage'));
const LocalAIPage = lazy(() => import('@/pages/admin/LocalAIPage'));
const DeveloperTools = lazy(() => import('@/pages/admin/DeveloperTools'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Overview
    { id: 'overview', label: 'Overview', icon: Plug },
    // Developer Tools
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    // Automation
    { id: 'automation', label: 'Automation', icon: Workflow },
    { id: 'bulk', label: 'Bulk Ops', icon: Database },
    { id: 'ai', label: 'Local AI', icon: Brain },
    // Developer
    { id: 'devtools', label: 'Dev Tools', icon: Wrench },
] as const;

type TabId = typeof tabs[number]['id'];

export default function IntegrationsHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'api';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab }, { replace: true });
    }, [setSearchParams]);

    return (
        <div className="space-y-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="border-b bg-card px-4 py-4">
                    <HubBreadcrumbs
                        hubName="integrations-hub"
                        hubHref="integrations-hub"
                        currentTab={tabs.find(t => t.id === activeTab)?.label}
                    />
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Integrations</h1>
                            <p className="text-muted-foreground text-sm">
                                APIs, webhooks, and automation
                            </p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <TabsList className="inline-flex min-w-max gap-0.5">
                            {tabs.map((tab) => (
                                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                    <tab.icon className="h-4 w-4" />
                                    <span className="text-xs sm:text-sm truncate">{tab.label}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                </div>

                <TabsContent value="overview" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><CustomIntegrationsPage /></Suspense>
                </TabsContent>
                <TabsContent value="api" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><APIAccessPage /></Suspense>
                </TabsContent>
                <TabsContent value="webhooks" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><WebhooksPage /></Suspense>
                </TabsContent>
                <TabsContent value="automation" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><AutomationPage /></Suspense>
                </TabsContent>
                <TabsContent value="bulk" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><BulkOperationsPage /></Suspense>
                </TabsContent>
                <TabsContent value="ai" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><LocalAIPage /></Suspense>
                </TabsContent>
                <TabsContent value="devtools" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><DeveloperTools /></Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
