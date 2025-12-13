/**
 * Compliance Hub Page
 * Consolidated compliance and security page with tabs:
 * - Overview: General compliance dashboard
 * - Vault: Compliance document vault
 * - Batch Recall: Batch recall management
 * - Audit: Audit trail and logs
 * - Risk: Risk management
 */

import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Shield,
    FileText,
    AlertCircle,
    ScrollText,
    AlertTriangle,
} from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load tab content for performance
const CompliancePage = lazy(() => import('@/pages/tenant-admin/CompliancePage'));
const ComplianceVaultPage = lazy(() => import('@/pages/admin/ComplianceVaultPage'));
const BatchRecallPage = lazy(() => import('@/pages/admin/BatchRecallPage'));
const AuditTrailPage = lazy(() => import('@/pages/admin/AuditTrail'));
const RiskFactorManagement = lazy(() => import('@/pages/admin/RiskFactorManagement'));

const TabSkeleton = () => (
    <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
    </div>
);

const tabs = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'vault', label: 'Vault', icon: FileText },
    { id: 'batch-recall', label: 'Batch Recall', icon: AlertCircle },
    { id: 'audit', label: 'Audit Trail', icon: ScrollText },
    { id: 'risk', label: 'Risk', icon: AlertTriangle },
] as const;

type TabId = typeof tabs[number]['id'];

export default function ComplianceHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'overview';

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab });
    };

    return (
        <div className="min-h-screen bg-background">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                {/* Header */}
                <div className="border-b bg-card px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold">Compliance & Security</h1>
                            <p className="text-muted-foreground text-sm">
                                Manage compliance documents, audits, and risk factors
                            </p>
                        </div>
                    </div>
                    <TabsList className="grid w-full max-w-xl grid-cols-5">
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                                <tab.icon className="h-4 w-4" />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <CompliancePage />
                    </Suspense>
                </TabsContent>

                {/* Vault Tab */}
                <TabsContent value="vault" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <ComplianceVaultPage />
                    </Suspense>
                </TabsContent>

                {/* Batch Recall Tab */}
                <TabsContent value="batch-recall" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <BatchRecallPage />
                    </Suspense>
                </TabsContent>

                {/* Audit Trail Tab */}
                <TabsContent value="audit" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <AuditTrailPage />
                    </Suspense>
                </TabsContent>

                {/* Risk Tab */}
                <TabsContent value="risk" className="m-0">
                    <Suspense fallback={<TabSkeleton />}>
                        <RiskFactorManagement />
                    </Suspense>
                </TabsContent>
            </Tabs>
        </div>
    );
}
