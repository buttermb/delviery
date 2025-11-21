
import { useState } from 'react';
import { Plus, Search, Bell, Settings, Menu as MenuIcon, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InsightCard } from './InsightCard';
import { LiveActivityFeed } from './LiveActivityFeed';
import { MenuCreationWizard } from './MenuCreationWizard';
import { EnhancedMenuDashboard } from './EnhancedMenuDashboard';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useSmartDashboard } from '@/hooks/useSmartDashboard';
import { Shield, Activity, MessageSquare } from 'lucide-react';
import { MenuCard } from './MenuCard';
import { SecurityAlertsPanel } from './SecurityAlertsPanel';
import { SecurityMonitoringPanel } from './SecurityMonitoringPanel';
import { NotificationSettings } from './NotificationSettings';
import { CustomerMessaging } from './CustomerMessaging';
import { AutomatedSecuritySettings } from './AutomatedSecuritySettings';
import { PanicModeButton } from './PanicModeButton';
import { EncryptionMigrationTool } from './EncryptionMigrationTool';
import { useDisposableMenus } from '@/hooks/useDisposableMenus';

export function SmartDashboard() {
    const { tenant } = useTenantAdminAuth();
    const [wizardOpen, setWizardOpen] = useState(false);
    const [encryptionToolOpen, setEncryptionToolOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const { insights, metrics, isLoading } = useSmartDashboard();
    const { data: menus } = useDisposableMenus(tenant?.id);

    const activeMenus = menus?.filter(m => m.status === 'active') || [];

    return (
        <div className="min-h-screen bg-background text-foreground p-6 space-y-8">
            {/* Top Navigation Bar */}
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Command Center</h1>
                        <p className="text-muted-foreground text-sm">Welcome back, {tenant?.business_name || 'Admin'}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex gap-4 mr-4">
                        <div className="text-center">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Active Users</div>
                            <div className="font-mono font-bold text-lg text-green-500 animate-pulse">
                                {metrics.activeUsers}
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Orders Today</div>
                            <div className="font-mono font-bold text-lg">
                                {metrics.ordersToday}
                            </div>
                        </div>
                    </div>

                    <div className="relative hidden md:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search menus, orders, or insights..."
                            className="pl-10 w-[300px] bg-muted/50 border-none"
                        />
                    </div>

                    <PanicModeButton />

                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="h-5 w-5" />
                        {metrics.securityAlerts > 0 && (
                            <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full" />
                        )}
                    </Button>
                    <Button
                        onClick={() => setWizardOpen(true)}
                        className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Menu
                    </Button>
                </div>
            </header>

            {/* AI Insights Grid */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <SparklesIcon className="h-4 w-4 text-yellow-500" />
                        Smart Insights
                    </h2>
                    <Badge variant="outline" className="font-mono text-xs">UPDATED JUST NOW</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {isLoading ? (
                        // Skeleton loading state
                        [1, 2, 3].map(i => (
                            <div key={i} className="h-40 rounded-xl bg-muted/20 animate-pulse" />
                        ))
                    ) : insights.length > 0 ? (
                        insights.map((insight, i) => (
                            <InsightCard
                                key={i}
                                type={insight.type}
                                title={insight.title}
                                description={insight.description}
                                metric={insight.confidence ? `${Math.round(insight.confidence * 100)}% Conf.` : undefined}
                                actionLabel={insight.recommendations?.[0]}
                                onAction={() => {
                                    if (insight.type === 'opportunity') setWizardOpen(true);
                                }}
                            />
                        ))
                    ) : (
                        <div className="col-span-3 text-center py-8 text-muted-foreground">
                            No new insights available at this time.
                        </div>
                    )}
                </div>
            </section>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Dashboard Tabs */}
                <div className="lg:col-span-2 space-y-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="w-full justify-start bg-muted/50 p-1 rounded-xl overflow-x-auto">
                            <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
                            <TabsTrigger value="menus" className="rounded-lg">Active Menus</TabsTrigger>
                            <TabsTrigger value="security" className="rounded-lg">Security</TabsTrigger>
                            <TabsTrigger value="monitoring" className="rounded-lg">Monitor</TabsTrigger>
                            <TabsTrigger value="messaging" className="rounded-lg">Messaging</TabsTrigger>
                            <TabsTrigger value="settings" className="rounded-lg">Settings</TabsTrigger>
                        </TabsList>

                        <div className="mt-6">
                            <TabsContent value="overview" className="m-0">
                                <EnhancedMenuDashboard />
                            </TabsContent>

                            <TabsContent value="menus">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {activeMenus.map(menu => (
                                        <MenuCard key={menu.id} menu={menu} />
                                    ))}
                                    {activeMenus.length === 0 && (
                                        <div className="col-span-2 text-center py-12 border rounded-xl border-dashed text-muted-foreground">
                                            No active menus found. Create one to get started.
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="security">
                                <SecurityAlertsPanel />
                            </TabsContent>

                            <TabsContent value="monitoring">
                                <SecurityMonitoringPanel />
                            </TabsContent>

                            <TabsContent value="messaging">
                                <CustomerMessaging />
                            </TabsContent>

                            <TabsContent value="settings">
                                <Tabs defaultValue="security-config">
                                    <TabsList>
                                        <TabsTrigger value="security-config">Security Rules</TabsTrigger>
                                        <TabsTrigger value="notifications">Notifications</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="security-config" className="mt-4">
                                        <AutomatedSecuritySettings />
                                    </TabsContent>
                                    <TabsContent value="notifications" className="mt-4">
                                        <NotificationSettings />
                                    </TabsContent>
                                </Tabs>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>

                {/* Right Column: Live Feed & Quick Actions */}
                <div className="space-y-6">
                    <LiveActivityFeed />

                    <div className="p-6 rounded-xl border bg-card">
                        <h3 className="font-semibold mb-4">Quick Actions</h3>
                        <div className="space-y-2">
                            <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab('settings')}>
                                <Settings className="h-4 w-4 mr-2" />
                                Configure Security Rules
                            </Button>
                            <Button variant="outline" className="w-full justify-start" onClick={() => setEncryptionToolOpen(true)}>
                                <Shield className="h-4 w-4 mr-2" />
                                Encryption Tool
                            </Button>
                            <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab('messaging')}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Customer Messaging
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <MenuCreationWizard open={wizardOpen} onOpenChange={setWizardOpen} />
            <EncryptionMigrationTool open={encryptionToolOpen} onOpenChange={setEncryptionToolOpen} tenantId={tenant?.id || ''} />
        </div>
    );
}

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z" />
        </svg>
    );
}
