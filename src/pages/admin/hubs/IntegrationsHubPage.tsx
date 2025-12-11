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
    Database
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const APIAccessPage = lazy(() => import('@/pages/tenant-admin/APIAccessPage'));
const WebhooksPage = lazy(() => import('@/pages/tenant-admin/WebhooksPage'));
const AutomationPage = lazy(() => import('@/pages/tenant-admin/AutomationPage'));
const BulkOperationsPage = lazy(() => import('@/pages/tenant-admin/BulkOperationsPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook },
    { id: 'automation', label: 'Automation', icon: Workflow },
    { id: 'bulk', label: 'Bulk Ops', icon: Database },
] as const;

type TabId = typeof tabs[number]['id'];

export default function IntegrationsHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'api';

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab });
    };

    return (
        <div className="min-h-screen bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="border-b bg-card px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Integrations</h1>
                            <p className="text-muted-foreground text-sm">
                                APIs, webhooks, and automation
                            </p>
                        </div>
                    </div>
                    <TabsList className="grid w-full max-w-xl grid-cols-4">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                <tab.icon className="h-4 w-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

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
            </Tabs>
        </div>
    );
}
