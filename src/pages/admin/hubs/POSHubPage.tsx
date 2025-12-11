/**
 * POS Hub Page
 * Consolidated Point of Sale page with tabs:
 * - Register: Main POS terminal
 * - Shifts: Shift management
 * - Z-Reports: End of day reports
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Clock, FileText } from 'lucide-react';

// Import existing components (reuse, don't duplicate)
import PointOfSale from '@/pages/admin/PointOfSale';
import { ShiftManager } from '@/components/pos/ShiftManager';
import ZReportContent from './panels/ZReportPanel';

// Lazy load for performance
import { lazy, Suspense } from 'react';

const tabs = [
    { id: 'register', label: 'Register', icon: CreditCard },
    { id: 'shifts', label: 'Shifts', icon: Clock },
    { id: 'z-reports', label: 'Z-Reports', icon: FileText },
] as const;

type TabId = typeof tabs[number]['id'];

export default function POSHubPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') as TabId) || 'register';

    const handleTabChange = (tab: string) => {
        setSearchParams({ tab });
    };

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
                        <TabsList className="grid w-full max-w-md grid-cols-3">
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
                    {/* Show mini tab switcher in corner for register view */}
                    <div className="fixed bottom-4 right-4 z-50 bg-card rounded-lg shadow-lg border p-1 flex gap-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`p-2 rounded ${activeTab === tab.id
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-muted'
                                    }`}
                                title={tab.label}
                            >
                                <tab.icon className="h-4 w-4" />
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
            </Tabs>
        </div>
    );
}
