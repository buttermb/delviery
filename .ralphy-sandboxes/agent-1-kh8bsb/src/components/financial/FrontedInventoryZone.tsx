/**
 * Fronted Inventory Zone (Zone C)
 * 
 * Consignment tracking with aging breakdown:
 * - Summary Card (Total value, units out, avg days)
 * - Aging Breakdown (0-7 green, 8-14 yellow, 15+ red)
 * - Active Consignments List with actions
 */

import { useState } from 'react';
import { Package, Clock, AlertTriangle, RefreshCw, DollarSign, Eye, ArrowRight, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useFrontedInventory, useFrontedActions, type FrontedItem } from '@/hooks/useFinancialCommandCenter';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { format } from 'date-fns';
import { formatCurrency, formatCompactCurrency } from '@/lib/formatters';

interface ConsignmentCardProps {
  item: FrontedItem;
  onCheckStatus: () => void;
  onConvertToSale: () => void;
  onRecall: () => void;
  onExtend?: () => void;
}

function ConsignmentCard({ item, onCheckStatus, onConvertToSale, onRecall, onExtend }: ConsignmentCardProps) {
  const statusColors = {
    healthy: 'bg-emerald-500/10 border-emerald-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
    overdue: 'bg-red-500/10 border-red-500/30'
  };

  const statusDotColors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    overdue: 'bg-red-500'
  };

  return (
    <div className={cn(
      "p-4 rounded-lg border transition-all",
      statusColors[item.status]
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            statusDotColors[item.status]
          )} />
          <span className="font-medium text-zinc-200">{item.clientName}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {item.daysOut} days
          </Badge>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        {item.products.map((product, i) => (
          <div key={i} className="text-sm text-zinc-400">
            {product.quantity} units {product.name} @ {formatCurrency(product.unitPrice)}/unit
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-zinc-500">Total Value</span>
          <div className="text-lg font-bold font-mono text-zinc-100">
            {formatCurrency(item.totalValue)}
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-zinc-500">Expected Return</span>
          <div className="text-sm text-zinc-300">
            {format(item.expectedReturn, 'MMM d')}
            {item.status === 'overdue' && (
              <span className="text-red-400 ml-1">(OVERDUE)</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs hover:bg-blue-500/20 hover:text-blue-400"
          onClick={onCheckStatus}
        >
          <Eye className="h-3 w-3 mr-0.5 sm:mr-1" />
          Status
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs hover:bg-emerald-500/20 hover:text-emerald-400"
          onClick={onConvertToSale}
        >
          <DollarSign className="h-3 w-3 mr-0.5 sm:mr-1" />
          Convert
        </Button>
        {item.status !== 'healthy' && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs hover:bg-red-500/20 hover:text-red-400"
            onClick={onRecall}
          >
            <RefreshCw className="h-3 w-3 mr-0.5 sm:mr-1" />
            Recall
          </Button>
        )}
        {item.status === 'warning' && onExtend && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-1.5 sm:px-2 text-[10px] sm:text-xs hover:bg-amber-500/20 hover:text-amber-400"
            onClick={onExtend}
          >
            <Clock className="h-3 w-3 mr-0.5 sm:mr-1" />
            Extend
          </Button>
        )}
      </div>
    </div>
  );
}

export function FrontedInventoryZone() {
  const { data, isLoading } = useFrontedInventory();
  const { convertToSale, recallInventory } = useFrontedActions();
  const { navigateToAdmin } = useTenantNavigation();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl bg-zinc-800/50" />
        <Skeleton className="h-32 w-full rounded-xl bg-zinc-800/50" />
      </div>
    );
  }

  if ((data?.items.length || 0) === 0) {
    return (
      <Card className="bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl">
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
          <div className="text-lg font-medium text-zinc-300 mb-2">
            No Active Consignments
          </div>
          <p className="text-sm text-zinc-500 mb-4 max-w-xs mx-auto">
            Front inventory to trusted clients to expand your reach
          </p>
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigateToAdmin('inventory/dispatch')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Consignment
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-zinc-900/90 to-zinc-800/90 border-zinc-700/50 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2 text-zinc-300">
              <Package className="h-4 w-4 text-blue-400" />
              FRONTED INVENTORY
            </span>
            <span className="text-lg font-bold text-zinc-100 font-mono">
              {formatCurrency(data?.totalValue)} at risk
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
            <div className="text-center p-2 sm:p-3 rounded-lg bg-zinc-800/50">
              <div className="text-lg sm:text-xl font-bold text-zinc-100">{data?.activeConsignments}</div>
              <div className="text-[9px] sm:text-[10px] text-zinc-500 uppercase">Active</div>
            </div>
            <div className="text-center p-2 sm:p-3 rounded-lg bg-zinc-800/50">
              <div className="text-lg sm:text-xl font-bold text-zinc-100">{data?.totalUnits}</div>
              <div className="text-[9px] sm:text-[10px] text-zinc-500 uppercase">Units Out</div>
            </div>
            <div className="text-center p-2 sm:p-3 rounded-lg bg-zinc-800/50">
              <div className="text-lg sm:text-xl font-bold text-zinc-100">{data?.avgDaysOut}</div>
              <div className="text-[9px] sm:text-[10px] text-zinc-500 uppercase">Avg Days</div>
            </div>
          </div>

          {/* Aging Breakdown */}
          <div className="space-y-2 pt-4 border-t border-zinc-800">
            <div className="text-xs text-zinc-500 uppercase mb-2">By Aging</div>
            
            {/* 0-7 Days (Healthy) */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-[10px] sm:text-xs text-zinc-400 w-12 sm:w-16 flex-shrink-0">0-7 days</span>
              <span className="text-[10px] sm:text-xs font-mono text-zinc-300 w-10 sm:w-12 flex-shrink-0 hidden xs:inline">{data?.aging.healthy.units} units</span>
              <div className="flex-1 min-w-0">
                <Progress 
                  value={data?.totalValue ? (data.aging.healthy.value / data.totalValue) * 100 : 0}
                  className="h-2 bg-zinc-800 [&>div]:bg-emerald-500"
                />
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-emerald-400 w-12 sm:w-16 text-right flex-shrink-0">
                {formatCompactCurrency(data?.aging.healthy.value || 0)}
              </span>
            </div>

            {/* 8-14 Days (Warning) */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="text-[10px] sm:text-xs text-zinc-400 w-12 sm:w-16 flex-shrink-0">8-14 days</span>
              <span className="text-[10px] sm:text-xs font-mono text-zinc-300 w-10 sm:w-12 flex-shrink-0 hidden xs:inline">{data?.aging.warning.units} units</span>
              <div className="flex-1 min-w-0">
                <Progress 
                  value={data?.totalValue ? (data.aging.warning.value / data.totalValue) * 100 : 0}
                  className="h-2 bg-zinc-800 [&>div]:bg-amber-500"
                />
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-amber-400 w-12 sm:w-16 text-right flex-shrink-0">
                {formatCompactCurrency(data?.aging.warning.value || 0)}
              </span>
            </div>

            {/* 15+ Days (Overdue) */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-[10px] sm:text-xs text-zinc-400 w-12 sm:w-16 flex-shrink-0">15+ days</span>
              <span className="text-[10px] sm:text-xs font-mono text-zinc-300 w-10 sm:w-12 flex-shrink-0 hidden xs:inline">{data?.aging.overdue.units} units</span>
              <div className="flex-1 min-w-0">
                <Progress 
                  value={data?.totalValue ? (data.aging.overdue.value / data.totalValue) * 100 : 0}
                  className="h-2 bg-zinc-800 [&>div]:bg-red-500"
                />
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-red-400 w-12 sm:w-16 text-right flex-shrink-0">
                {formatCompactCurrency(data?.aging.overdue.value || 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Score */}
      <Card className={cn(
        "border backdrop-blur-xl",
        (data?.healthScore || 0) >= 75 
          ? "bg-zinc-900/80 border-zinc-800/50"
          : "bg-amber-950/30 border-amber-800/50"
      )}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">INVENTORY HEALTH</span>
            <span className={cn(
              "text-lg font-bold font-mono",
              (data?.healthScore || 0) >= 75 ? "text-emerald-400" : "text-amber-400"
            )}>
              {Math.round(data?.healthScore || 0)}%
            </span>
          </div>
          
          <Slider
            value={[data?.healthScore || 0]}
            max={100}
            step={1}
            disabled
            className="[&_[role=slider]]:hidden"
          />
          
          <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
            <span>At Risk</span>
            <span>Healthy</span>
          </div>

          {(data?.healthScore || 0) < 75 && (
            <div className="mt-3 text-xs text-amber-400/80 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Consider recalling aging inventory or converting to sales
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Consignments */}
      <Card className="bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between text-zinc-300">
            PRODUCT IN THE FIELD
            <Badge variant="outline">{data?.items.length} active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.items
            .sort((a, b) => b.daysOut - a.daysOut) // Sort by days out (oldest first)
            .slice(0, showAll ? undefined : 3)
            .map((item) => (
              <ConsignmentCard
                key={item.id}
                item={item}
                onCheckStatus={() => navigateToAdmin(`inventory/fronted/${item.id}`)}
                onConvertToSale={() => convertToSale.mutate(item.id)}
                onRecall={() => recallInventory.mutate(item.id)}
              />
            ))}

          {(data?.items.length || 0) > 3 && !showAll && (
            <Button
              variant="ghost"
              className="w-full text-zinc-400 hover:text-zinc-200"
              onClick={() => setShowAll(true)}
            >
              Show all {data?.items.length} consignments
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full border-zinc-700 hover:bg-zinc-800"
            onClick={() => navigateToAdmin('inventory/dispatch')}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Front
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

