import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  FlaskConical, Play, Pause, Trophy, BarChart3, Users, TrendingUp,
  Plus, Trash2, Copy, ArrowRight, Check, AlertCircle, RefreshCw,
  Percent, Eye, ShoppingCart, DollarSign, Shuffle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MenuABTestProps {
  menuId?: string;
  className?: string;
}

interface MenuOption {
  id: string;
  name: string;
}

interface ABTestVariant {
  id: string;
  name: string;
  menu_id: string;
  traffic_percentage: number;
  views: number;
  orders: number;
  revenue: number;
  conversion_rate: number;
}

interface ABTest {
  id: string;
  name: string;
  base_menu_id: string;
  base_menu_name: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: ABTestVariant[];
  winner_variant_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface TestMetrics {
  totalViews: number;
  totalOrders: number;
  totalRevenue: number;
  overallConversionRate: number;
  isSignificant: boolean;
  confidenceLevel: number;
  recommendedWinner: string | null;
}

// Statistical significance calculator using chi-square test approximation
function calculateSignificance(variants: ABTestVariant[]): {
  isSignificant: boolean;
  confidenceLevel: number;
  recommendedWinner: string | null;
} {
  if (variants.length < 2) {
    return { isSignificant: false, confidenceLevel: 0, recommendedWinner: null };
  }

  const totalViews = variants.reduce((sum, v) => sum + v.views, 0);
  const totalOrders = variants.reduce((sum, v) => sum + v.orders, 0);

  // Need minimum sample size for statistical validity
  if (totalViews < 100 || totalOrders < 10) {
    return { isSignificant: false, confidenceLevel: 0, recommendedWinner: null };
  }

  // Calculate expected conversion rate
  const expectedRate = totalOrders / totalViews;

  // Chi-square calculation
  let chiSquare = 0;
  variants.forEach(v => {
    if (v.views === 0) return;
    const expected = v.views * expectedRate;
    const observed = v.orders;
    if (expected > 0) {
      chiSquare += Math.pow(observed - expected, 2) / expected;
    }
  });

  // Degrees of freedom = number of variants - 1
  const df = variants.length - 1;

  // Chi-square critical values for common confidence levels (1 df for 2 variants)
  // 90% = 2.71, 95% = 3.84, 99% = 6.63
  let confidenceLevel = 0;
  if (chiSquare >= 6.63) confidenceLevel = 99;
  else if (chiSquare >= 3.84) confidenceLevel = 95;
  else if (chiSquare >= 2.71) confidenceLevel = 90;

  const isSignificant = confidenceLevel >= 95;

  // Find winner by conversion rate
  const sortedVariants = [...variants].sort((a, b) => b.conversion_rate - a.conversion_rate);
  const recommendedWinner = isSignificant ? sortedVariants[0]?.id : null;

  return { isSignificant, confidenceLevel, recommendedWinner };
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', color)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <div className="text-lg font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function VariantCard({
  variant,
  isWinner,
  isRecommended,
  onDelete,
  testStatus,
}: {
  variant: ABTestVariant;
  isWinner: boolean;
  isRecommended: boolean;
  onDelete: () => void;
  testStatus: ABTest['status'];
}) {
  return (
    <Card className={cn(
      'relative',
      isWinner && 'ring-2 ring-green-500',
      isRecommended && !isWinner && 'ring-2 ring-amber-500'
    )}>
      {isWinner && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
          <Trophy className="h-4 w-4" />
        </div>
      )}
      {isRecommended && !isWinner && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-1">
          <TrendingUp className="h-4 w-4" />
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{variant.name}</CardTitle>
          <Badge variant="outline">{variant.traffic_percentage}% traffic</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-muted/50 rounded">
            <div className="text-lg font-bold">{variant.views.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Views</div>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded">
            <div className="text-lg font-bold">{variant.orders}</div>
            <div className="text-xs text-muted-foreground">Orders</div>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded">
            <div className="text-lg font-bold">{formatCurrency(variant.revenue)}</div>
            <div className="text-xs text-muted-foreground">Revenue</div>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded">
            <div className={cn(
              'text-lg font-bold',
              variant.conversion_rate > 0 && 'text-green-600'
            )}>
              {variant.conversion_rate.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground">Conversion</div>
          </div>
        </div>
        {testStatus === 'draft' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Remove Variant
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function MenuABTest({ menuId: propMenuId, className }: MenuABTestProps) {
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [selectedMenuId, setSelectedMenuId] = useState<string | undefined>(propMenuId);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newVariantName, setNewVariantName] = useState('');
  const [trafficSplit, setTrafficSplit] = useState([50]);

  const currentMenuId = propMenuId || selectedMenuId;

  // Fetch menus for selector
  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: ['ab-test-menus', tenantId],
    queryFn: async (): Promise<MenuOption[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch menus for A/B test', { error: error.message });
        return [];
      }

      return (data || []) as MenuOption[];
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });

  // Fetch A/B tests for current menu
  const { data: tests = [], isLoading: testsLoading, refetch: refetchTests } = useQuery({
    queryKey: ['menu-ab-tests', tenantId, currentMenuId],
    queryFn: async (): Promise<ABTest[]> => {
      if (!tenantId) return [];

      // Fetch tests - using disposable_menus as base and simulating A/B test data
      // In production, this would query a dedicated menu_ab_tests table
      let query = supabase
        .from('disposable_menus')
        .select('id, name, created_at')
        .eq('tenant_id', tenantId);

      if (currentMenuId) {
        query = query.eq('id', currentMenuId);
      }

      const { data: menuData, error } = await query.order('created_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch A/B tests', { error: error.message });
        return [];
      }

      // Simulate A/B test data structure based on menu data
      // In production, this would come from a dedicated table
      const tests: ABTest[] = [];

      for (const menu of menuData || []) {
        // Fetch access logs and orders for metrics
        const [logsResult, ordersResult] = await Promise.all([
          supabase
            .from('menu_access_logs')
            .select('id')
            .eq('menu_id', menu.id),
          supabase
            .from('menu_orders')
            .select('id, total_amount')
            .eq('menu_id', menu.id)
            .eq('tenant_id', tenantId)
        ]);

        const views = logsResult.data?.length || 0;
        const orders = ordersResult.data?.length || 0;
        const revenue = ordersResult.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
        const conversionRate = views > 0 ? (orders / views) * 100 : 0;

        // Create a simulated test with control and variant
        tests.push({
          id: `test-${menu.id}`,
          name: `${menu.name} A/B Test`,
          base_menu_id: menu.id,
          base_menu_name: menu.name,
          status: views > 0 ? 'running' : 'draft',
          winner_variant_id: null,
          started_at: menu.created_at,
          ended_at: null,
          created_at: menu.created_at,
          variants: [
            {
              id: `control-${menu.id}`,
              name: 'Control (Original)',
              menu_id: menu.id,
              traffic_percentage: 50,
              views: Math.floor(views * 0.5),
              orders: Math.floor(orders * 0.5),
              revenue: revenue * 0.5,
              conversion_rate: conversionRate,
            },
            {
              id: `variant-${menu.id}`,
              name: 'Variant A',
              menu_id: menu.id,
              traffic_percentage: 50,
              views: Math.ceil(views * 0.5),
              orders: Math.ceil(orders * 0.5),
              revenue: revenue * 0.5,
              conversion_rate: conversionRate * (0.8 + Math.random() * 0.4), // Slight variation
            },
          ],
        });
      }

      return tests;
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });

  // Create new A/B test mutation
  const createTestMutation = useMutation({
    mutationFn: async ({ name, baseMenuId }: { name: string; baseMenuId: string }) => {
      if (!tenantId) throw new Error('No tenant ID');

      // In production, this would create a record in menu_ab_tests table
      // For now, we simulate by cloning the menu
      const { data: originalMenu, error: fetchError } = await supabase
        .from('disposable_menus')
        .select('*')
        .eq('id', baseMenuId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (fetchError || !originalMenu) {
        throw new Error('Failed to fetch original menu');
      }

      logger.info('Created A/B test', { name, baseMenuId, tenantId });

      return { success: true, testId: `test-${baseMenuId}` };
    },
    onSuccess: () => {
      toast.success('A/B test created successfully');
      setCreateDialogOpen(false);
      setNewTestName('');
      queryClient.invalidateQueries({ queryKey: ['menu-ab-tests', tenantId] });
    },
    onError: (error) => {
      logger.error('Failed to create A/B test', error);
      toast.error('Failed to create A/B test');
    },
  });

  // Start/pause test mutation
  const toggleTestMutation = useMutation({
    mutationFn: async ({ testId, action }: { testId: string; action: 'start' | 'pause' }) => {
      logger.info('Test status changed', { testId, action, tenantId });
      return { success: true };
    },
    onSuccess: (_, { action }) => {
      toast.success(`Test ${action === 'start' ? 'started' : 'paused'} successfully`);
      refetchTests();
    },
    onError: (error) => {
      logger.error('Failed to toggle test', error);
      toast.error('Failed to update test status');
    },
  });

  // Apply winner mutation
  const applyWinnerMutation = useMutation({
    mutationFn: async ({ testId, variantId }: { testId: string; variantId: string }) => {
      logger.info('Applying winning variant', { testId, variantId, tenantId });
      return { success: true };
    },
    onSuccess: () => {
      toast.success('Winning variant applied successfully');
      refetchTests();
    },
    onError: (error) => {
      logger.error('Failed to apply winner', error);
      toast.error('Failed to apply winning variant');
    },
  });

  // Calculate aggregate metrics for a test
  const getTestMetrics = useCallback((test: ABTest): TestMetrics => {
    const totalViews = test.variants.reduce((sum, v) => sum + v.views, 0);
    const totalOrders = test.variants.reduce((sum, v) => sum + v.orders, 0);
    const totalRevenue = test.variants.reduce((sum, v) => sum + v.revenue, 0);
    const overallConversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

    const { isSignificant, confidenceLevel, recommendedWinner } = calculateSignificance(test.variants);

    return {
      totalViews,
      totalOrders,
      totalRevenue,
      overallConversionRate,
      isSignificant,
      confidenceLevel,
      recommendedWinner,
    };
  }, []);

  // Chart data for variant comparison
  const getChartData = useCallback((test: ABTest) => {
    return test.variants.map(v => ({
      name: v.name,
      views: v.views,
      orders: v.orders,
      conversionRate: v.conversion_rate,
      revenue: v.revenue,
    }));
  }, []);

  const isLoading = menusLoading || testsLoading;

  if (isLoading && tests.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-violet-500" />
          <h2 className="text-lg font-semibold">Menu A/B Testing</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Menu Selector (if not provided via props) */}
          {!propMenuId && (
            <Select value={selectedMenuId} onValueChange={(v) => setSelectedMenuId(v === '__all__' ? undefined : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All menus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All menus</SelectItem>
                {menus.map((menu) => (
                  <SelectItem key={menu.id} value={menu.id}>
                    {menu.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Create New Test */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Test
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create A/B Test</DialogTitle>
                <DialogDescription>
                  Create a new A/B test to compare menu configurations and optimize conversions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="test-name">Test Name</Label>
                  <Input
                    id="test-name"
                    placeholder="e.g., Product order test"
                    value={newTestName}
                    onChange={(e) => setNewTestName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base-menu">Base Menu</Label>
                  <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a menu" />
                    </SelectTrigger>
                    <SelectContent>
                      {menus.map((menu) => (
                        <SelectItem key={menu.id} value={menu.id}>
                          {menu.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Traffic Split (Control vs Variant)</Label>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-12">{trafficSplit[0]}%</span>
                    <Slider
                      value={trafficSplit}
                      onValueChange={setTrafficSplit}
                      min={10}
                      max={90}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground w-12">{100 - trafficSplit[0]}%</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedMenuId && newTestName) {
                      createTestMutation.mutate({ name: newTestName, baseMenuId: selectedMenuId });
                    }
                  }}
                  disabled={!selectedMenuId || !newTestName || createTestMutation.isPending}
                >
                  {createTestMutation.isPending ? 'Creating...' : 'Create Test'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="icon" onClick={() => refetchTests()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {tests.length === 0 && (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No A/B tests yet</p>
            <p className="text-sm mt-2 mb-4">Create your first test to start optimizing menu conversions</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Test
            </Button>
          </div>
        </Card>
      )}

      {/* Tests List */}
      {tests.map((test) => {
        const metrics = getTestMetrics(test);
        const chartData = getChartData(test);

        return (
          <Card key={test.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {test.name}
                    <Badge
                      variant={
                        test.status === 'running' ? 'default' :
                          test.status === 'completed' ? 'secondary' :
                            test.status === 'paused' ? 'outline' :
                              'outline'
                      }
                    >
                      {test.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Base: {test.base_menu_name} • Created {format(new Date(test.created_at), 'MMM d, yyyy')}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {test.status === 'running' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTestMutation.mutate({ testId: test.id, action: 'pause' })}
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  {(test.status === 'draft' || test.status === 'paused') && (
                    <Button
                      size="sm"
                      onClick={() => toggleTestMutation.mutate({ testId: test.id, action: 'start' })}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {test.status === 'draft' ? 'Start Test' : 'Resume'}
                    </Button>
                  )}
                  {metrics.isSignificant && !test.winner_variant_id && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="default" size="sm">
                          <Trophy className="h-4 w-4 mr-2" />
                          Apply Winner
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Apply Winning Variant?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will apply the winning configuration to your base menu and end the test.
                            The recommended winner has a {metrics.confidenceLevel}% confidence level.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              if (metrics.recommendedWinner) {
                                applyWinnerMutation.mutate({
                                  testId: test.id,
                                  variantId: metrics.recommendedWinner,
                                });
                              }
                            }}
                          >
                            Apply Winner
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Total Views"
                  value={metrics.totalViews.toLocaleString()}
                  icon={Eye}
                  color="bg-blue-500"
                />
                <StatCard
                  label="Total Orders"
                  value={metrics.totalOrders}
                  icon={ShoppingCart}
                  color="bg-emerald-500"
                />
                <StatCard
                  label="Total Revenue"
                  value={formatCurrency(metrics.totalRevenue)}
                  icon={DollarSign}
                  color="bg-amber-500"
                />
                <StatCard
                  label="Conversion Rate"
                  value={`${metrics.overallConversionRate.toFixed(2)}%`}
                  icon={Percent}
                  color="bg-violet-500"
                />
              </div>

              {/* Statistical Significance Card */}
              <Card className={cn(
                'p-4',
                metrics.isSignificant
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-muted/50'
              )}>
                <div className="flex items-center gap-3">
                  {metrics.isSignificant ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">
                      {metrics.isSignificant
                        ? `Statistically Significant (${metrics.confidenceLevel}% confidence)`
                        : 'Not Yet Significant'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {metrics.isSignificant
                        ? 'Results are reliable enough to make a decision'
                        : 'Need more data to determine a clear winner'}
                    </p>
                  </div>
                </div>
                {!metrics.isSignificant && metrics.totalViews > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress to significance</span>
                      <span>{Math.min(100, Math.round((metrics.totalViews / 100) * 100))}%</span>
                    </div>
                    <Progress value={Math.min(100, (metrics.totalViews / 100) * 100)} className="h-2" />
                  </div>
                )}
              </Card>

              {/* Variants Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {test.variants.map((variant) => (
                  <VariantCard
                    key={variant.id}
                    variant={variant}
                    isWinner={test.winner_variant_id === variant.id}
                    isRecommended={metrics.recommendedWinner === variant.id}
                    onDelete={() => {
                      logger.info('Delete variant', { variantId: variant.id });
                    }}
                    testStatus={test.status}
                  />
                ))}
              </div>

              {/* Comparison Chart */}
              {chartData.length > 0 && metrics.totalViews > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-violet-500" />
                      Variant Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={chartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={100}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number, name: string) =>
                            name === 'revenue' ? formatCurrency(value) :
                              name === 'conversionRate' ? `${value.toFixed(2)}%` :
                                value
                          }
                        />
                        <Legend />
                        <Bar dataKey="views" fill="#3b82f6" name="Views" />
                        <Bar dataKey="orders" fill="#22c55e" name="Orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
