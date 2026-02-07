import { useState } from "react";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import MoreVertical from "lucide-react/dist/esm/icons/more-vertical";
import Pause from "lucide-react/dist/esm/icons/pause";
import Play from "lucide-react/dist/esm/icons/play";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Package from "lucide-react/dist/esm/icons/package";
import Clock from "lucide-react/dist/esm/icons/clock";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Zap from "lucide-react/dist/esm/icons/zap";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useRecurringOrders,
  RecurringOrderSchedule,
} from "@/hooks/useRecurringOrders";
import { RecurringOrderSetup } from "./RecurringOrderSetup";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { cn } from "@/lib/utils";

interface RecurringOrdersListProps {
  clientId?: string;
  compact?: boolean;
}

function RecurringOrdersListComponent({ clientId, compact = false }: RecurringOrdersListProps) {
  const {
    schedules,
    activeSchedules,
    upcomingCount,
    totalMonthlyValue,
    isLoading,
    toggleActive,
    deleteSchedule,
    triggerOrderNow,
  } = useRecurringOrders();

  const [editingSchedule, setEditingSchedule] = useState<RecurringOrderSchedule | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  // Filter by client if provided
  const displaySchedules = clientId
    ? schedules.filter((s) => s.client_id === clientId)
    : schedules;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      weekly: "Weekly",
      biweekly: "Bi-Weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
    };
    return labels[frequency] || frequency;
  };

  const getNextOrderStatus = (nextDate: string) => {
    const next = new Date(nextDate);
    const now = new Date();
    const daysUntil = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) {
      return { label: "Overdue", variant: "destructive" as const };
    }
    if (daysUntil === 0) {
      return { label: "Today", variant: "default" as const };
    }
    if (daysUntil === 1) {
      return { label: "Tomorrow", variant: "default" as const };
    }
    if (daysUntil <= 7) {
      return { label: `In ${daysUntil} days`, variant: "secondary" as const };
    }
    return { label: formatSmartDate(nextDate), variant: "outline" as const };
  };

  const calculateOrderTotal = (items: RecurringOrderSchedule["order_items"]) => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {!compact && !clientId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <RefreshCw className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Schedules</p>
                  <p className="text-2xl font-bold">{activeSchedules.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due This Week</p>
                  <p className="text-2xl font-bold">{upcomingCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Value</p>
                  <p className="text-2xl font-bold font-mono">
                    {formatCurrency(totalMonthlyValue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {clientId ? "Recurring Orders" : "All Recurring Order Schedules"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {displaySchedules.length} schedule{displaySchedules.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          New Schedule
        </Button>
      </div>

      {/* Schedules List */}
      {displaySchedules.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold mb-2">No Recurring Orders</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Set up recurring orders to automate regular deliveries for your clients.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Create First Schedule
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {displaySchedules.map((schedule) => {
            const orderTotal = calculateOrderTotal(schedule.order_items);
            const nextOrderStatus = getNextOrderStatus(schedule.next_order_date);
            const itemCount = schedule.order_items.length;

            return (
              <Card
                key={schedule.id}
                className={cn(
                  "transition-colors",
                  !schedule.is_active && "opacity-60 bg-muted/50"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={cn(
                            "p-2 rounded-lg",
                            schedule.is_active ? "bg-primary/10" : "bg-muted"
                          )}
                        >
                          <RefreshCw
                            className={cn(
                              "h-5 w-5",
                              schedule.is_active ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold truncate">{schedule.name}</h4>
                            {!schedule.is_active && (
                              <Badge variant="secondary">Paused</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate">
                              {schedule.client?.business_name || "Unknown Client"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Frequency</p>
                          <p className="font-medium">
                            {getFrequencyLabel(schedule.frequency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Next Order</p>
                          <Badge variant={nextOrderStatus.variant} className="mt-1">
                            {nextOrderStatus.label}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Products</p>
                          <p className="font-medium">{itemCount} items</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Order Value</p>
                          <p className="font-medium font-mono">{formatCurrency(orderTotal)}</p>
                        </div>
                      </div>

                      {/* Order Items Preview */}
                      {!compact && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex flex-wrap gap-2">
                            {schedule.order_items.slice(0, 3).map((item, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                <Package className="h-3 w-3 mr-1" />
                                {item.product_name} × {item.quantity}
                              </Badge>
                            ))}
                            {schedule.order_items.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{schedule.order_items.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Automation Badges */}
                      {(schedule.auto_confirm || schedule.auto_assign_runner) && (
                        <div className="flex gap-2 mt-3">
                          {schedule.auto_confirm && (
                            <Badge variant="outline" className="text-xs text-emerald-600">
                              <Zap className="h-3 w-3 mr-1" />
                              Auto-confirm
                            </Badge>
                          )}
                          {schedule.auto_assign_runner && schedule.preferred_runner && (
                            <Badge variant="outline" className="text-xs text-blue-600">
                              <Zap className="h-3 w-3 mr-1" />
                              Auto-assign: {schedule.preferred_runner.full_name}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => triggerOrderNow.mutate(schedule.id)}
                          disabled={triggerOrderNow.isPending}
                        >
                          <Zap className="h-4 w-4 mr-2" />
                          Create Order Now
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditingSchedule(schedule)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Schedule
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            toggleActive.mutate({
                              id: schedule.id,
                              is_active: !schedule.is_active,
                            })
                          }
                        >
                          {schedule.is_active ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause Schedule
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Resume Schedule
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setScheduleToDelete(schedule.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Schedule
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <RecurringOrderSetup
        open={showCreateDialog || !!editingSchedule}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingSchedule(null);
          }
        }}
        editSchedule={editingSchedule || undefined}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!scheduleToDelete}
        onOpenChange={(open) => !open && setScheduleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Order Schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this recurring order schedule. No new orders will be
              created from this schedule. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (scheduleToDelete) {
                  deleteSchedule.mutate(scheduleToDelete);
                  setScheduleToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { RecurringOrdersListComponent as RecurringOrdersList };
