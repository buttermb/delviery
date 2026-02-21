/**
 * Board Report Page
 * 
 * Executive summary view for board meetings
 */

import { logger } from '@/lib/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, TrendingUp, TrendingDown, DollarSign, Users, Package, AlertCircle } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { showInfoToast, showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { formatSmartDate } from '@/lib/formatters';

export default function BoardReportPage() {
    const { tenant } = useTenantAdminAuth();

    // Fetch key metrics for board report
    const { data: metricsData, isLoading } = useQuery({
        queryKey: ['board-report-metrics', tenant?.id],
        queryFn: async () => {
            if (!tenant?.id) throw new Error('No tenant');

            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const sixtyDaysAgo = new Date(today);
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

            // Get MTD revenue
            const { data: mtdOrders } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('tenant_id', tenant.id)
                .gte('created_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())
                .not('status', 'in', '("cancelled","rejected","refunded")');

            const mtdRevenue = mtdOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

            // Get last 30 days vs previous 30 days
            const { data: last30Days } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('tenant_id', tenant.id)
                .gte('created_at', thirtyDaysAgo.toISOString())
                .not('status', 'in', '("cancelled","rejected","refunded")');

            const { data: previous30Days } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('tenant_id', tenant.id)
                .gte('created_at', sixtyDaysAgo.toISOString())
                .lt('created_at', thirtyDaysAgo.toISOString())
                .not('status', 'in', '("cancelled","rejected","refunded")');

            const revenue30Days = last30Days?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
            const revenuePrevious30 = previous30Days?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
            const revenueGrowth = revenuePrevious30 > 0
                ? ((revenue30Days - revenuePrevious30) / revenuePrevious30) * 100
                : 0;

            // Get customer count
            const { count: customerCount } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id);

            // Get product count
            const { count: productCount } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id);

            return {
                mtdRevenue,
                revenue30Days,
                revenueGrowth,
                customerCount: customerCount || 0,
                productCount: productCount || 0,
            };
        },
        enabled: !!tenant?.id,
    });

    const reportRef = useRef<HTMLDivElement>(null);

    const handleExport = async () => {
        if (!reportRef.current) return;

        try {
            showInfoToast("Exporting", "Generating PDF report...");

            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                logging: false,
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`Board_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            showSuccessToast("Export Complete", "Board report downloaded successfully");
        } catch (error) {
            logger.error('Export failed:', error instanceof Error ? error : new Error(String(error)), { component: 'BoardReportPage' });
            showErrorToast("Export Failed", "Could not generate PDF report");
        }
    };

    if (isLoading) {
        return <EnhancedLoadingState variant="dashboard" message="Loading report..." />;
    }

    return (
        <div className="space-y-6" ref={reportRef}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <FileText className="h-8 w-8" />
                        Board Report
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Executive summary for {formatSmartDate(new Date(), { relative: false })}
                    </p>
                </div>
                <Button onClick={handleExport} className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export PDF
                </Button>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">MTD Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${metricsData?.mtdRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Month-to-date</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">30-Day Growth</CardTitle>
                        {(metricsData?.revenueGrowth || 0) >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${(metricsData?.revenueGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(metricsData?.revenueGrowth || 0).toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">vs. previous 30 days</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metricsData?.customerCount.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Active accounts</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Product Catalog</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metricsData?.productCount.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">SKUs in inventory</p>
                    </CardContent>
                </Card>
            </div>

            {/* Strategic Highlights */}
            <Card>
                <CardHeader>
                    <CardTitle>Strategic Highlights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-green-900 dark:text-green-100">Revenue Growth</h4>
                            <p className="text-sm text-green-800 dark:text-green-200">
                                {(metricsData?.revenueGrowth || 0) >= 0
                                    ? `Revenue increased by ${(metricsData?.revenueGrowth || 0).toFixed(1)}% over the past 30 days.`
                                    : `Revenue declined by ${Math.abs(metricsData?.revenueGrowth || 0).toFixed(1)}% over the past 30 days.`
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-blue-900 dark:text-blue-100">Customer Base</h4>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                Currently serving {metricsData?.customerCount} active customers across all channels.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                            <h4 className="font-medium text-amber-900 dark:text-amber-100">Action Items</h4>
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                Review operational metrics and customer feedback for continued improvement.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Footer */}
            <Card>
                <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground text-center">
                        Generated on {formatSmartDate(new Date(), { relative: false })}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
