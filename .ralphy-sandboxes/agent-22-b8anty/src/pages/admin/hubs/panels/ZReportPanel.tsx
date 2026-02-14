/**
 * Z-Report Panel
 * Extracted from ZReportPage.tsx for use in POSHubPage
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { ZReport } from '@/components/pos/ZReport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useRealtimeShifts } from '@/hooks/useRealtimePOS';

export default function ZReportPanel() {
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;
    const [selectedShiftId, setSelectedShiftId] = useState<string>('');

    // Enable real-time updates for shifts
    useRealtimeShifts(tenantId);

    const { data: shifts, isLoading } = useQuery({
        queryKey: ['closed-shifts', tenantId],
        queryFn: async () => {
            if (!tenantId) return [];

            const { data, error } = await supabase
                .from('pos_shifts')
                .select('*')
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
        return <div className="p-6 text-center">Loading shifts...</div>;
    }

    return (
        <div className="p-6 space-y-6">
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
                            {shifts?.map((shift: any) => (
                                <SelectItem key={shift.id} value={shift.id}>
                                    <div className="flex items-center justify-between gap-4">
                                        <span>
                                            {shift.shift_number} - {shift.cashier_name}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {new Date(shift.ended_at).toLocaleDateString()}
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
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        No closed shifts found. Close a shift to generate a Z-Report.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
