import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Wallet from "lucide-react/dist/esm/icons/wallet";
import ArrowUpCircle from "lucide-react/dist/esm/icons/arrow-up-circle";
import ArrowDownCircle from "lucide-react/dist/esm/icons/arrow-down-circle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Clock from "lucide-react/dist/esm/icons/clock";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import LockOpen from "lucide-react/dist/esm/icons/lock-open";
import Lock from "lucide-react/dist/esm/icons/lock";
import { useCashDrawer, type CashDrawerEvent, type CashDrawerEventType } from '@/hooks/useCashDrawer';
import { CashCountDialog } from './CashCountDialog';
import { CashDrawerEventDialog } from './CashDrawerEventDialog';

interface CashDrawerPanelProps {
  shiftId: string | undefined;
  openingCash: number;
  expectedCash: number;
  className?: string;
}

const eventTypeConfig: Record<CashDrawerEventType, { label: string; icon: React.ReactNode; color: string }> = {
  open: { label: 'Opened', icon: <LockOpen className="h-3 w-3" />, color: 'text-green-600' },
  close: { label: 'Closed', icon: <Lock className="h-3 w-3" />, color: 'text-red-600' },
  add: { label: 'Cash In', icon: <ArrowDownCircle className="h-3 w-3" />, color: 'text-green-600' },
  remove: { label: 'Cash Out', icon: <ArrowUpCircle className="h-3 w-3" />, color: 'text-amber-600' },
  payout: { label: 'Payout', icon: <ArrowUpCircle className="h-3 w-3" />, color: 'text-red-600' },
  deposit: { label: 'Deposit', icon: <ArrowDownCircle className="h-3 w-3" />, color: 'text-blue-600' },
};

export function CashDrawerPanel({ shiftId, openingCash, expectedCash, className }: CashDrawerPanelProps) {
  const { drawerState, events, isLoading, isPending, addCash, removeCash, recordPayout } = useCashDrawer(shiftId);
  const [countDialogOpen, setCountDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventDialogType, setEventDialogType] = useState<'add' | 'remove' | 'payout'>('add');

  const handleOpenEventDialog = (type: 'add' | 'remove' | 'payout') => {
    setEventDialogType(type);
    setEventDialogOpen(true);
  };

  const handleEventConfirm = async (amount: number, reason: string) => {
    switch (eventDialogType) {
      case 'add':
        await addCash(amount, reason);
        break;
      case 'remove':
        await removeCash(amount, reason);
        break;
      case 'payout':
        await recordPayout(amount, reason);
        break;
    }
    setEventDialogOpen(false);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!shiftId) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Cash Drawer
          </CardTitle>
          <CardDescription>Start a shift to track drawer activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-5 w-5 mr-2" />
            No active shift
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Cash Drawer
              </CardTitle>
              <CardDescription>Track cash in and out</CardDescription>
            </div>
            <Badge
              variant={drawerState.isOpen ? 'default' : 'secondary'}
              className="gap-1"
            >
              {drawerState.isOpen ? (
                <>
                  <LockOpen className="h-3 w-3" />
                  Open
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  Closed
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Balance Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Opening Cash</p>
              <p className="text-lg font-bold">${openingCash.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Expected</p>
              <p className="text-lg font-bold">${expectedCash.toFixed(2)}</p>
            </div>
          </div>

          {/* Current Drawer Balance */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current Drawer</p>
                <p className="text-2xl font-bold">${drawerState.currentBalance.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-primary/50" />
            </div>
            {drawerState.currentBalance !== expectedCash && (
              <div className="mt-2 flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">Variance:</span>
                <span className={drawerState.currentBalance > expectedCash ? 'text-green-600' : 'text-red-600'}>
                  {drawerState.currentBalance > expectedCash ? '+' : ''}
                  ${(drawerState.currentBalance - expectedCash).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEventDialog('add')}
              disabled={isPending || isLoading}
              className="flex-col h-auto py-2 gap-1"
            >
              <ArrowDownCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs">Add Cash</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEventDialog('remove')}
              disabled={isPending || isLoading}
              className="flex-col h-auto py-2 gap-1"
            >
              <ArrowUpCircle className="h-4 w-4 text-amber-600" />
              <span className="text-xs">Remove</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEventDialog('payout')}
              disabled={isPending || isLoading}
              className="flex-col h-auto py-2 gap-1"
            >
              <ArrowUpCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs">Payout</span>
            </Button>
          </div>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setCountDialogOpen(true)}
            disabled={isPending || isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Count Drawer
          </Button>

          <Separator />

          {/* Recent Events */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Recent Activity
            </h4>
            {isLoading ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Loading...
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No drawer activity yet
              </div>
            ) : (
              <ScrollArea className="h-40">
                <div className="space-y-2">
                  {events.slice(0, 10).map((event: CashDrawerEvent) => {
                    const config = eventTypeConfig[event.event_type];
                    return (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className={config.color}>{config.icon}</span>
                          <div>
                            <span className="font-medium">{config.label}</span>
                            {event.reason && (
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {event.reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-mono ${config.color}`}>
                            {event.event_type === 'remove' || event.event_type === 'payout' ? '-' : '+'}
                            ${event.amount.toFixed(2)}
                          </span>
                          <p className="text-xs text-muted-foreground">{formatTime(event.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>

      <CashCountDialog
        open={countDialogOpen}
        onOpenChange={setCountDialogOpen}
        expectedAmount={expectedCash}
        shiftId={shiftId}
      />

      <CashDrawerEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        type={eventDialogType}
        onConfirm={handleEventConfirm}
        isPending={isPending}
      />
    </>
  );
}
