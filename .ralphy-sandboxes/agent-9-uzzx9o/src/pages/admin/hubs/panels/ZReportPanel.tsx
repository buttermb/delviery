/**
 * Z-Report Panel
 * Extracted from ZReportPage.tsx for use in POSHubPage
 */

import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatSmartDate } from '@/lib/formatters';
import { ZReport } from '@/components/pos/ZReport';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRealtimeShifts } from '@/hooks/useRealtimePOS';
import { queryKeys } from '@/lib/queryKeys';

export default function ZReportPanel() {
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;
    const [selectedShiftId, setSelectedShiftId] = useState<string>('');

    // Enable real-time updates for shifts
    useRealtimeShifts(tenantId);

    const { data: shifts, isLoading, isError, refetch } = useQuery({
        queryKey: queryKeys.closedShifts.byTenant(tenantId),
        queryFn: async () => {
            if (!tenantId) return [];

            const { data, error } = await supabase
                .from('pos_shifts')
                .select('id, shift_number, cashier_name, total_sales, ended_at, status')
                .eq('tenant_id', tenantId)
                .eq('status', 'closed')
                .order('ended_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return data;
        },
        enabled: !!tenantId,
        refetchInterval: 30000,
    });

    if (isLoading) {
        return <EnhancedLoadingState variant="table" message="Loading shifts..." />;
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                <p className="text-sm text-muted-foreground">Failed to load shift reports. Please try again.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Select Shift</CardTitle>
                    <CardDescription>Choose a closed shift to view its Z-Report</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a shift..." />
                        </SelectTrigger>
                        <SelectContent>
                            {shifts?.map((shift) => (
                                <SelectItem key={shift.id} value={shift.id}>
                                    <div className="flex items-center justify-between gap-4">
                                        <span>
                                            {shift.shift_number} - {shift.cashier_name}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {formatSmartDate(shift.ended_at)}
                                        </span>
                                        <Badge variant="outline">${shift.total_sales.toFixed(2)}</Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedShiftId && <ZReport shiftId={selectedShiftId} />}

            {!selectedShiftId && shifts && shifts.length === 0 && (
                <EmptyState
                    icon={BarChart}
                    title="No shift reports yet"
                    description="Reports are generated when you complete a shift"
                />
            )}
        </div>
    );
}
