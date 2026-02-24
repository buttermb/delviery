/**
 * Vendor Price History Component
 * Shows vendor cost pricing over time with trend indicators
 * Displays price change alerts and history for margin analysis
 * Task 167: Create vendor product price history
 */

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, TrendingUp, TrendingDown, History, AlertTriangle, Settings, X, DollarSign } from 'lucide-react';

import {
  useVendorPriceHistory,
  useVendorPriceAlerts,
  useDismissPriceAlert,
  useVendorPriceAlertSettings,
  useUpdatePriceAlertSettings,
} from '@/hooks/useVendorPriceHistory';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

interface VendorPriceHistoryProps {
  vendorId: string;
  vendorName: string;
}

type TimeRange = '30d' | '90d' | '1y' | 'all';

interface ChartDataPoint {
  date: string;
  displayDate: string;
  cost: number;
  productName: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number | null;
    color: string;
    name: string;
    payload: ChartDataPoint;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0]?.payload;
  if (!data) return null;

  const displayDate = data.date ? format(parseISO(data.date), 'MMM d, yyyy h:mm a') : '';

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[180px]">
      <p className="text-sm font-medium mb-2">{displayDate}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Cost:</span>
          <span className="font-medium">{formatCurrency(data.cost)}</span>
        </div>
        {data.productName && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Product:</span>
            <span className="font-medium text-xs truncate max-w-[150px]">{data.productName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertSettingsDialog({
  vendorId,
  vendorName,
}: {
  vendorId: string;
  vendorName: string;
}) {
  const { data: settings, isLoading } = useVendorPriceAlertSettings(vendorId);
  const updateSettings = useUpdatePriceAlertSettings();
  const [threshold, setThreshold] = useState('10');
  const [isEnabled, setIsEnabled] = useState(true);
  const [open, setOpen] = useState(false);

  // Get vendor-level setting (no product_id)
  const vendorSetting = settings?.find((s) => !s.product_id);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        vendorId,
        thresholdPercent: parseFloat(threshold),
        isEnabled,
      });
      toast.success('Alert settings saved');
      setOpen(false);
    } catch (error) {
      toast.error('Failed to save settings', { description: humanizeError(error) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Alert Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Price Alert Settings</DialogTitle>
          <DialogDescription>
            Configure when to receive alerts for price increases from {vendorName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Price Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts when vendor raises prices
                  </p>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={setIsEnabled}
                  defaultChecked={vendorSetting?.is_enabled ?? true}
                />
              </div>

              <div className="space-y-2">
                <Label>Alert Threshold (%)</Label>
                <Input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="10"
                  min="1"
                  max="100"
                  defaultValue={vendorSetting?.alert_threshold_percent?.toString() ?? '10'}
                />
                <p className="text-xs text-muted-foreground">
                  Alert when price increases by this percentage or more
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="w-full"
              >
                {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Settings
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PriceAlertsSection({ vendorId }: { vendorId: string }) {
  const { data: alerts = [], isLoading } = useVendorPriceAlerts(vendorId);
  const dismissAlert = useDismissPriceAlert();

  const handleDismiss = async (alertId: string) => {
    try {
      await dismissAlert.mutateAsync(alertId);
      toast.success('Alert dismissed');
    } catch (error) {
      toast.error('Failed to dismiss alert', { description: humanizeError(error) });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          Price Increase Alerts ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 bg-background rounded-lg border"
            >
              <div className="flex-1">
                <p className="font-medium">{alert.product?.name || 'Unknown Product'}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <span>
                    {formatCurrency(alert.cost_old)} → {formatCurrency(alert.cost_new)}
                  </span>
                  <Badge variant="destructive" className="text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +{alert.change_percent.toFixed(1)}%
                  </Badge>
                  <span className="text-xs">
                    {format(parseISO(alert.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(alert.id)}
                disabled={dismissAlert.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function VendorPriceHistory({ vendorId, vendorName }: VendorPriceHistoryProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');

  const { data: history = [], isLoading, error } = useVendorPriceHistory(
    vendorId,
    selectedProduct !== 'all' ? selectedProduct : undefined
  );

  // Get unique products from history
  const products = useMemo(() => {
    const productMap = new Map<string, string>();
    history.forEach((entry) => {
      if (!productMap.has(entry.product_id)) {
        productMap.set(entry.product_id, entry.product_name);
      }
    });
    return Array.from(productMap, ([id, name]) => ({ id, name }));
  }, [history]);

  // Filter by time range
  const filteredHistory = useMemo(() => {
    if (timeRange === 'all') return history;

    const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const cutoff = subDays(new Date(), days);

    return history.filter((entry) => parseISO(entry.changed_at) >= cutoff);
  }, [history, timeRange]);

  // Format data for chart
  const chartData: ChartDataPoint[] = useMemo(() => {
    return filteredHistory.map((entry) => ({
      date: entry.changed_at,
      displayDate: format(parseISO(entry.changed_at), 'MMM d, yyyy'),
      cost: entry.cost_new,
      productName: entry.product_name,
    })).reverse(); // Oldest first for chart
  }, [filteredHistory]);

  // Calculate stats
  const stats = useMemo(() => {
    if (filteredHistory.length === 0) {
      return { totalChanges: 0, avgChange: 0, increases: 0, decreases: 0 };
    }

    let increases = 0;
    let decreases = 0;
    let totalPercent = 0;

    filteredHistory.forEach((entry) => {
      if (entry.change_percent > 0) increases++;
      else if (entry.change_percent < 0) decreases++;
      totalPercent += entry.change_percent;
    });

    return {
      totalChanges: filteredHistory.length,
      avgChange: totalPercent / filteredHistory.length,
      increases,
      decreases,
    };
  }, [filteredHistory]);

  const handleTimeRangeChange = (value: string) => {
    if (value) {
      setTimeRange(value as TimeRange);
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-destructive">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load price history</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Price Alerts */}
      <PriceAlertsSection vendorId={vendorId} />

      {/* Main Chart Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Vendor Cost History
              </CardTitle>
              <CardDescription>
                Track cost price changes from {vendorName} over time
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <AlertSettingsDialog vendorId={vendorId} vendorName={vendorName} />
              <ToggleGroup
                type="single"
                value={timeRange}
                onValueChange={handleTimeRangeChange}
                className="justify-start"
              >
                <ToggleGroupItem value="30d" aria-label="30 days" className="text-xs">
                  30d
                </ToggleGroupItem>
                <ToggleGroupItem value="90d" aria-label="90 days" className="text-xs">
                  90d
                </ToggleGroupItem>
                <ToggleGroupItem value="1y" aria-label="1 year" className="text-xs">
                  1y
                </ToggleGroupItem>
                <ToggleGroupItem value="all" aria-label="All time" className="text-xs">
                  All
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Product Filter */}
          {products.length > 1 && (
            <div className="mb-6">
              <Label className="text-sm text-muted-foreground mb-2 block">Filter by Product</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <EnhancedEmptyState
              icon={DollarSign}
              title="No Price History"
              description={`No cost price changes from ${vendorName} in the selected time range.`}
            />
          ) : (
            <>
              {/* Stats Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total Changes</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.totalChanges}</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Avg Change</p>
                  <p className={`text-lg font-bold ${stats.avgChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Price Increases</p>
                  <p className="text-2xl font-bold text-red-600">{stats.increases}</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Price Decreases</p>
                  <p className="text-2xl font-bold text-green-600">{stats.decreases}</p>
                </div>
              </div>

              {/* Chart */}
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value: string) => {
                      const date = parseISO(value);
                      return timeRange === '30d'
                        ? format(date, 'MMM d')
                        : timeRange === '90d'
                        ? format(date, 'MMM d')
                        : format(date, 'MMM yyyy');
                    }}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value: number) => `$${value}`}
                    className="text-muted-foreground"
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="cost"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#f59e0b' }}
                    activeDot={{ r: 6, fill: '#f59e0b' }}
                    name="Cost"
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </CardContent>
      </Card>

      {/* Price History Table */}
      {filteredHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Price Change Log</CardTitle>
            <CardDescription>
              Detailed history of cost changes for margin analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Old Cost</TableHead>
                    <TableHead className="text-right">New Cost</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.slice(0, 20).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(parseISO(entry.changed_at), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {entry.product_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(entry.cost_old)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(entry.cost_new)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            entry.change_percent > 0
                              ? 'text-red-600 border-red-600'
                              : entry.change_percent < 0
                              ? 'text-green-600 border-green-600'
                              : ''
                          }
                        >
                          {entry.change_percent > 0 ? (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          ) : entry.change_percent < 0 ? (
                            <TrendingDown className="h-3 w-3 mr-1" />
                          ) : null}
                          {entry.change_percent >= 0 ? '+' : ''}
                          {entry.change_percent.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {entry.change_source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {entry.change_reason || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredHistory.length > 20 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Showing 20 of {filteredHistory.length} entries
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
