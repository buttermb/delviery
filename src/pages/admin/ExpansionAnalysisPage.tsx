/**
 * Expansion Analysis Page
 *
 * Market opportunity assessment and ROI analysis for business expansion
 */

import { useState, useMemo, useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, MapPin, TrendingUp, DollarSign, Users, Calculator, AlertCircle } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { formatCurrency } from '@/lib/formatters';

interface MarketOpportunity {
  name: string;
  badge: string;
  badgeVariant: 'default' | 'secondary' | 'outline';
  population: string;
  income: string;
  competition: string;
  estimatedRevenue: number;
  dimmed?: boolean;
}

const MARKET_OPPORTUNITIES: MarketOpportunity[] = [
  {
    name: 'New Location - Downtown District',
    badge: 'High Potential',
    badgeVariant: 'secondary',
    population: '50,000+',
    income: '$75,000',
    competition: 'Medium',
    estimatedRevenue: 18000,
    dimmed: false,
  },
  {
    name: 'Online Expansion',
    badge: 'Recommended',
    badgeVariant: 'default',
    population: 'Regional (500k+)',
    income: '$25,000 initial',
    competition: 'Low',
    estimatedRevenue: 12000,
    dimmed: false,
  },
  {
    name: 'Suburban Location',
    badge: 'Moderate Potential',
    badgeVariant: 'outline',
    population: '25,000+',
    income: '$65,000',
    competition: 'High',
    estimatedRevenue: 10000,
    dimmed: true,
  },
];

interface NextStep {
  label: string;
  status: string;
}

const NEXT_STEPS: NextStep[] = [
  { label: 'Conduct market research', status: 'Not Started' },
  { label: 'Secure funding and permits', status: 'Not Started' },
  { label: 'Finalize location and staffing', status: 'Not Started' },
];

function ExpansionPageSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`input-skeleton-${i}`} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-24 w-full mt-6" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`opp-skeleton-${i}`} className="h-32 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ExpansionAnalysisPage() {
  const { tenant, loading } = useTenantAdminAuth();
  const formId = useId();

  const [investment, setInvestment] = useState<number>(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(0);
  const [monthlyCosts, setMonthlyCosts] = useState<number>(0);

  const roi = useMemo(() => {
    const monthlyProfit = monthlyRevenue - monthlyCosts;
    const breakEven = monthlyProfit > 0 ? investment / monthlyProfit : 0;
    const annualProfit = monthlyProfit * 12;
    const roiPercent = investment > 0 ? ((annualProfit - investment) / investment) * 100 : 0;
    return { monthlyProfit, breakEven, roiPercent };
  }, [investment, monthlyRevenue, monthlyCosts]);

  if (loading || !tenant) {
    return <ExpansionPageSkeleton />;
  }

  const hasInput = investment > 0 || monthlyRevenue > 0 || monthlyCosts > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Globe className="h-8 w-8" />
          Expansion Analysis
        </h1>
        <p className="text-muted-foreground mt-1">Market opportunity assessment and growth planning</p>
      </div>

      {/* ROI Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            ROI Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${formId}-investment`}>Initial Investment</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id={`${formId}-investment`}
                  type="number"
                  min={0}
                  placeholder="50000"
                  value={investment || ''}
                  onChange={(e) => setInvestment(Number(e.target.value) || 0)}
                  className="pl-10"
                  aria-label="Initial investment amount in dollars"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${formId}-revenue`}>Expected Monthly Revenue</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id={`${formId}-revenue`}
                  type="number"
                  min={0}
                  placeholder="15000"
                  value={monthlyRevenue || ''}
                  onChange={(e) => setMonthlyRevenue(Number(e.target.value) || 0)}
                  className="pl-10"
                  aria-label="Expected monthly revenue in dollars"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${formId}-costs`}>Monthly Operating Costs</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id={`${formId}-costs`}
                  type="number"
                  min={0}
                  placeholder="8000"
                  value={monthlyCosts || ''}
                  onChange={(e) => setMonthlyCosts(Number(e.target.value) || 0)}
                  className="pl-10"
                  aria-label="Monthly operating costs in dollars"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-lg" role="region" aria-label="ROI calculation results">
            {hasInput ? (
              <div className="grid gap-2 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Profit</p>
                  <p className={`text-2xl font-bold ${roi.monthlyProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {formatCurrency(roi.monthlyProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Break-even Period</p>
                  <p className="text-2xl font-bold">
                    {roi.breakEven > 0 ? `${roi.breakEven.toFixed(1)} months` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">12-Month ROI</p>
                  <p className={`text-2xl font-bold ${roi.roiPercent >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {roi.roiPercent.toFixed(0)}%
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                Enter values above to calculate ROI
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Market Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Market Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {MARKET_OPPORTUNITIES.map((opp) => (
            <div
              key={opp.name}
              className={`flex items-start justify-between p-4 border rounded-lg hover:shadow-md transition-shadow ${opp.dimmed ? 'opacity-60' : ''}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold">{opp.name}</h4>
                  <Badge variant={opp.badgeVariant}>{opp.badge}</Badge>
                </div>
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <p><strong>Population:</strong> {opp.population}</p>
                  <p><strong>Avg. Income:</strong> {opp.income}</p>
                  <p><strong>Competition:</strong> {opp.competition}</p>
                  <p><strong>Est. Monthly Revenue:</strong> {formatCurrency(opp.estimatedRevenue)}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Key Considerations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Key Considerations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Users className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">Market Demand</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Analyze customer demographics and purchasing power in target areas.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <DollarSign className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-amber-900 dark:text-amber-100">Capital Requirements</h4>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Ensure adequate funding for initial setup, inventory, and 3-6 months operating costs.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
            <TrendingUp className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-green-900 dark:text-green-100">Growth Potential</h4>
              <p className="text-sm text-green-800 dark:text-green-200">
                Evaluate long-term market trends and sustainability of the expansion opportunity.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {NEXT_STEPS.map((step, index) => (
            <div key={step.label} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold" aria-hidden="true">
                  {index + 1}
                </div>
                <span className="font-medium">{step.label}</span>
              </div>
              <Badge variant="outline">{step.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
