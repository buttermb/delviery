/**
 * Delivery P&L Card
 * Shows delivery profitability breakdown on order detail page.
 * Allows recording/editing delivery costs (runner pay, fuel, time).
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { DeliveryCostInput } from '@/types/deliveryCosts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import TrendingDown from 'lucide-react/dist/esm/icons/trending-down';
import Edit from 'lucide-react/dist/esm/icons/edit';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { useDeliveryCostByOrder, useSaveDeliveryCost } from '@/hooks/useDeliveryCosts';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { cn } from '@/lib/utils';

const deliveryCostSchema = z.object({
  runner_pay: z.coerce.number().min(0, 'Must be 0 or more'),
  fuel_estimate: z.coerce.number().min(0, 'Must be 0 or more'),
  time_cost: z.coerce.number().min(0, 'Must be 0 or more'),
  other_costs: z.coerce.number().min(0, 'Must be 0 or more'),
});

type DeliveryCostFormData = z.infer<typeof deliveryCostSchema>;

interface DeliveryPLCardProps {
  orderId: string;
  deliveryFee: number;
  tipAmount?: number;
  courierId?: string | null;
  distanceMiles?: number | null;
  deliveryTimeMinutes?: number | null;
  deliveryZone?: string | null;
  deliveryBorough?: string | null;
}

export function DeliveryPLCard({
  orderId,
  deliveryFee,
  tipAmount = 0,
  courierId,
  distanceMiles,
  deliveryTimeMinutes,
  deliveryZone,
  deliveryBorough,
}: DeliveryPLCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: costData, isLoading } = useDeliveryCostByOrder(orderId);
  const saveMutation = useSaveDeliveryCost();

  const form = useForm<DeliveryCostFormData>({
    resolver: zodResolver(deliveryCostSchema),
    defaultValues: {
      runner_pay: 0,
      fuel_estimate: 0,
      time_cost: 0,
      other_costs: 0,
    },
  });

  // Populate form when data loads
  useEffect(() => {
    if (costData) {
      form.reset({
        runner_pay: costData.runner_pay,
        fuel_estimate: costData.fuel_estimate,
        time_cost: costData.time_cost,
        other_costs: costData.other_costs,
      });
    }
  }, [costData, form]);

  const handleSave = async (formData: DeliveryCostFormData) => {
    const input: DeliveryCostInput = {
      order_id: orderId,
      courier_id: courierId,
      runner_pay: formData.runner_pay,
      fuel_estimate: formData.fuel_estimate,
      time_cost: formData.time_cost,
      other_costs: formData.other_costs,
      delivery_fee_collected: deliveryFee,
      tip_amount: tipAmount,
      distance_miles: distanceMiles,
      delivery_time_minutes: deliveryTimeMinutes,
      delivery_zone: deliveryZone,
      delivery_borough: deliveryBorough,
    };

    try {
      await saveMutation.mutateAsync(input);
      toast.success("Delivery costs saved");
      setDialogOpen(false);
    } catch (error) {
      toast.error("Failed to save delivery costs", { description: humanizeError(error) });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = deliveryFee + tipAmount;
  const totalCost = costData
    ? costData.runner_pay + costData.fuel_estimate + costData.time_cost + costData.other_costs
    : 0;
  const profit = totalRevenue - totalCost;
  const isProfitable = profit >= 0;
  const hasCostData = !!costData;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Delivery P&L
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="w-3.5 h-3.5 mr-1.5" />
                {hasCostData ? 'Edit Costs' : 'Record Costs'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delivery Cost Breakdown</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="runner_pay">Runner Pay ($)</Label>
                    <Input
                      id="runner_pay"
                      type="number"
                      step="0.01"
                      {...form.register('runner_pay')}
                    />
                    {form.formState.errors.runner_pay && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.runner_pay.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fuel_estimate">Fuel Estimate ($)</Label>
                    <Input
                      id="fuel_estimate"
                      type="number"
                      step="0.01"
                      {...form.register('fuel_estimate')}
                    />
                    {form.formState.errors.fuel_estimate && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.fuel_estimate.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time_cost">Time Cost ($)</Label>
                    <Input
                      id="time_cost"
                      type="number"
                      step="0.01"
                      {...form.register('time_cost')}
                    />
                    {form.formState.errors.time_cost && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.time_cost.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="other_costs">Other Costs ($)</Label>
                    <Input
                      id="other_costs"
                      type="number"
                      step="0.01"
                      {...form.register('other_costs')}
                    />
                    {form.formState.errors.other_costs && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.other_costs.message}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>{formatCurrency(deliveryFee)}</span>
                  </div>
                  {tipAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tip</span>
                      <span>{formatCurrency(tipAmount)}</span>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Save Costs
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasCostData ? (
          <>
            {/* Revenue */}
            <div className="space-y-1 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Revenue</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tip</span>
                  <span>{formatCurrency(tipAmount)}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Costs */}
            <div className="space-y-1 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Costs</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Runner Pay</span>
                <span className="text-destructive">-{formatCurrency(costData.runner_pay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fuel Estimate</span>
                <span className="text-destructive">-{formatCurrency(costData.fuel_estimate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Cost</span>
                <span className="text-destructive">-{formatCurrency(costData.time_cost)}</span>
              </div>
              {costData.other_costs > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other</span>
                  <span className="text-destructive">-{formatCurrency(costData.other_costs)}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Profit */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                {isProfitable ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className="font-semibold">Profit</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-lg font-bold',
                    isProfitable ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    isProfitable
                      ? 'bg-green-500/10 text-green-600 border-green-500/20'
                      : 'bg-red-500/10 text-red-600 border-red-500/20'
                  )}
                >
                  {isProfitable ? 'Profitable' : 'Loss'}
                </Badge>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              No delivery costs recorded yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Fee collected: {formatCurrency(deliveryFee)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
