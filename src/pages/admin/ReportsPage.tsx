/**
 * Reports Page - Comprehensive reporting and analytics
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, FileText, Package, DollarSign, Download,
  Calendar, TrendingUp
} from 'lucide-react';
import { useAccount } from '@/contexts/AccountContext';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export default function ReportsPage() {
  const { account } = useAccount();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [reportType, setReportType] = useState<string>('business');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">📊 Reports</h1>
          <p className="text-muted-foreground">Business intelligence and analytics</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs value={reportType} onValueChange={setReportType} className="space-y-6">
        <TabsList>
          <TabsTrigger value="business">
            <BarChart3 className="h-4 w-4 mr-2" />
            Business Intelligence
          </TabsTrigger>
          <TabsTrigger value="custody">
            <FileText className="h-4 w-4 mr-2" />
            Chain of Custody
          </TabsTrigger>
          <TabsTrigger value="inventory">
            <Package className="h-4 w-4 mr-2" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="financial">
            <DollarSign className="h-4 w-4 mr-2" />
            Financial
          </TabsTrigger>
        </TabsList>

        {/* Business Intelligence */}
        <TabsContent value="business">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">Total Revenue</div>
              <div className="text-2xl font-bold">$312,000</div>
              <div className="text-sm text-emerald-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                +12.5% vs last month
              </div>
            </Card>
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">Orders</div>
              <div className="text-2xl font-bold">47</div>
              <div className="text-sm text-emerald-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                +8 vs last month
              </div>
            </Card>
            <Card className="p-6">
              <div className="text-sm text-muted-foreground mb-1">Avg Order Value</div>
              <div className="text-2xl font-bold">$6,638</div>
              <div className="text-sm text-emerald-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                +4.2% vs last month
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
            <div className="h-[400px] flex items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Chart visualization</p>
                <p className="text-xs mt-1">Revenue trends, order volume, client performance</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Chain of Custody */}
        <TabsContent value="custody">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Chain of Custody Reports</h3>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Batch Tracking Report</h4>
                    <p className="text-sm text-muted-foreground">
                      Complete audit trail for all batches
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Transfer History</h4>
                    <p className="text-sm text-muted-foreground">
                      All inventory transfers and movements
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Package Scans</h4>
                    <p className="text-sm text-muted-foreground">
                      All barcode/QR code scans and verifications
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Inventory Reports */}
        <TabsContent value="inventory">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Inventory Reports</h3>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Stock Levels by Warehouse</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Current inventory levels across all locations
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Movement History</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  All inventory movements and transfers
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Low Stock Alerts</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Items below reorder point
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Financial Reports */}
        <TabsContent value="financial">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Financial Reports</h3>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">P&L Statement</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Profit and loss statement for selected period
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Cash Flow Report</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Incoming and outgoing cash flow
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Credit Report</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Outstanding credit and collections
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

