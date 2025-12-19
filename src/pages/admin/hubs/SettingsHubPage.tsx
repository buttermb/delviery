/**
 * Settings Hub Page
 * Consolidated settings with tabs:
 * - General: General settings
 * - Billing: Billing and subscription  
 * - Integrations: API, webhooks, automation
 * - Security: Security settings
 * - Support: Help and support
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Settings,
    CreditCard,
    Plug,
    Shield,
    Headphones,
} from 'lucide-react';
import { lazy, Suspense, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage'));
const BillingPage = lazy(() => import('@/pages/tenant-admin/BillingPage'));
const APIAccessPage = lazy(() => import('@/pages/tenant-admin/APIAccessPage'));
const SecurityPage = lazy(() => import('@/pages/super-admin/SecurityPage'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    // Configuration
    { id: 'general', label: 'General', icon: Settings },
    // Account
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Shield },
    // Tools
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'support', label: 'Support', icon: Headphones },
] as const;

type TabId = typeof tabs[number]['id'];

export default function SettingsHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'general';

    const handleTabChange = useCallback((tab: string) => {
        setSearchParams({ tab });
    }, [setSearchParams]);

    return (
        <div className="min-h-screen bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <div className="border-b bg-card px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Settings</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage your account and preferences
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

                <TabsContent value="general" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><SettingsPage /></Suspense>
                </TabsContent>
                <TabsContent value="billing" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><BillingPage /></Suspense>
                </TabsContent>
                <TabsContent value="integrations" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><APIAccessPage /></Suspense>
                </TabsContent>
                <TabsContent value="security" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><SecurityPage /></Suspense>
                </TabsContent>
                <TabsContent value="support" className="m-0">
                    <Suspense fallback={<TabSkeleton />}><HelpPage /></Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
