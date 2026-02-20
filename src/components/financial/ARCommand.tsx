/**
 * AR Command (Zone B)
 * 
 * Outstanding receivables with urgency-based organization:
 * - Outstanding Summary (Glanceable)
 * - Priority Collection List (Actionable)
 * - Bulk Actions
 */

import { useState } from 'react';
import { Phone, MessageSquare, Mail, Clock, AlertCircle, Send, FileText, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useARCommand, useCollectionActions, type ARClient } from '@/hooks/useFinancialCommandCenter';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { formatCurrency, formatCompactCurrency } from '@/lib/formatters';

interface ClientCardProps {
  client: ARClient;
  onCall: () => void;
  onText: () => void;
  onInvoice: () => void;
  onRemind: () => void;
}

function ClientCard({ client, onCall, onText, onInvoice, onRemind }: ClientCardProps) {
  return (
    <div className={cn(
      "p-4 rounded-lg border transition-all",
      client.daysOverdue > 0 
        ? "bg-red-950/30 border-red-800/50" 
        : "bg-zinc-900/50 border-zinc-800/50"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-medium text-zinc-200">{client.name}</div>
          <div className={cn(
            "text-xs flex items-center gap-1 mt-1",
            client.daysOverdue > 0 ? "text-red-400" : "text-zinc-500"
          )}>
            <Clock className="h-3 w-3" />
            {client.daysOverdue > 0 
              ? `${client.daysOverdue} days overdue` 
              : 'Due soon'
            }
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold font-mono text-zinc-100">
            {formatCurrency(client.amount)}
          </div>
        </div>
      </div>

      {client.lastContact && (
        <div className="text-[10px] text-zinc-500 mb-3">
          Last contact: {client.lastContact.toLocaleDateString()}
        </div>
      )}

      <Progress 
        value={client.paidPercentage} 
        className="h-1.5 mb-3 bg-zinc-800 [&>div]:bg-emerald-500"
      />

      <div className="flex flex-wrap gap-1.5">
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-7 sm:h-8 px-1.5 sm:px-2 text-[10px] sm:text-xs hover:bg-emerald-500/20 hover:text-emerald-400 min-h-[44px] sm:min-h-0"
          onClick={onCall}
        >
          <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
          Call
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-7 sm:h-8 px-1.5 sm:px-2 text-[10px] sm:text-xs hover:bg-blue-500/20 hover:text-blue-400 min-h-[44px] sm:min-h-0"
          onClick={onText}
        >
          <MessageSquare className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
          Text
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-7 sm:h-8 px-1.5 sm:px-2 text-[10px] sm:text-xs hover:bg-amber-500/20 hover:text-amber-400 min-h-[44px] sm:min-h-0"
          onClick={onInvoice}
        >
          <Mail className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
          Invoice
        </Button>
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-7 sm:h-8 px-1.5 sm:px-2 text-[10px] sm:text-xs hover:bg-purple-500/20 hover:text-purple-400 min-h-[44px] sm:min-h-0"
          onClick={onRemind}
        >
          <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1" />
          Remind
        </Button>
      </div>
    </div>
  );
}

export function ARCommand() {
  const { data, isLoading } = useARCommand();
  const { sendAllReminders, logActivity } = useCollectionActions();
  const { navigateToAdmin } = useTenantNavigation();
  const [expandedView, setExpandedView] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl bg-zinc-800/50" />
        <Skeleton className="h-48 w-full rounded-xl bg-zinc-800/50" />
      </div>
    );
  }

  const handleAction = (clientId: string, type: 'call' | 'text' | 'invoice' | 'reminder') => {
    logActivity.mutate({ clientId, type });
  };

  const handleSendAllReminders = () => {
    const clientIds = data?.priorityClients.map(c => c.id) || [];
    if (clientIds.length > 0) {
      sendAllReminders.mutate(clientIds);
    }
  };

  const overduePercentage = data?.totalOutstanding 
    ? (data.overdue / data.totalOutstanding) * 100 
    : 0;

  return (
    <div className="space-y-4">
      {/* Outstanding Summary */}
      <Card className="bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span className="flex items-center gap-2 text-zinc-300">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              MONEY COMING IN
            </span>
            <span className="text-lg font-bold text-zinc-100 font-mono">
              {formatCurrency(data?.totalOutstanding)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Overdue */}
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-zinc-400 flex-1">OVERDUE</span>
            <span className="text-sm font-mono text-red-400">
              {formatCompactCurrency(data?.overdue || 0)}
            </span>
            <Progress 
              value={overduePercentage} 
              className="w-24 h-2 bg-zinc-800 [&>div]:bg-red-500"
            />
          </div>

          {/* Due This Week */}
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-xs text-zinc-400 flex-1">DUE THIS WEEK</span>
            <span className="text-sm font-mono text-amber-400">
              {formatCompactCurrency(data?.dueThisWeek || 0)}
            </span>
            <Progress 
              value={data?.totalOutstanding ? (data.dueThisWeek / data.totalOutstanding) * 100 : 0} 
              className="w-24 h-2 bg-zinc-800 [&>div]:bg-amber-500"
            />
          </div>

          {/* Upcoming */}
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-zinc-400 flex-1">UPCOMING</span>
            <span className="text-sm font-mono text-emerald-400">
              {formatCompactCurrency(data?.upcoming || 0)}
            </span>
            <Progress 
              value={data?.totalOutstanding ? (data.upcoming / data.totalOutstanding) * 100 : 0} 
              className="w-24 h-2 bg-zinc-800 [&>div]:bg-emerald-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSendAllReminders}
              disabled={sendAllReminders.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              Send All Reminders
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              className="border-zinc-700 hover:bg-zinc-800"
              onClick={() => navigateToAdmin('collection-mode')}
            >
              Collection Mode
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Priority Collection List */}
      <Card className="bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-zinc-300">
            <AlertCircle className="h-4 w-4 text-red-400" />
            NEEDS ATTENTION NOW
            {(data?.overdueCount || 0) > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {data?.overdueCount} overdue
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.priorityClients.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              <div className="text-3xl mb-2">✅</div>
              <div className="font-medium">All caught up!</div>
              <div className="text-xs mt-1">No overdue receivables</div>
            </div>
          ) : (
            <>
              {data?.priorityClients.slice(0, expandedView ? undefined : 3).map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onCall={() => handleAction(client.id, 'call')}
                  onText={() => handleAction(client.id, 'text')}
                  onInvoice={() => handleAction(client.id, 'invoice')}
                  onRemind={() => handleAction(client.id, 'reminder')}
                />
              ))}
              
              {(data?.priorityClients.length || 0) > 3 && !expandedView && (
                <Button
                  variant="ghost"
                  className="w-full text-zinc-400 hover:text-zinc-200"
                  onClick={() => setExpandedView(true)}
                >
                  + {(data?.priorityClients.length || 0) - 3} more accounts
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card className="bg-zinc-900/50 border-zinc-800/50 backdrop-blur-xl">
        <CardContent className="py-3">
          <div className="flex gap-2 overflow-x-auto">
            <Button 
              size="sm" 
              variant="outline" 
              className="whitespace-nowrap border-zinc-700 hover:bg-zinc-800"
              onClick={() => navigateToAdmin('invoices')}
            >
              <Mail className="h-4 w-4 mr-2" />
              Send All Invoices
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="whitespace-nowrap border-zinc-700 hover:bg-zinc-800"
              onClick={() => navigateToAdmin('reports')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Export AR Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

