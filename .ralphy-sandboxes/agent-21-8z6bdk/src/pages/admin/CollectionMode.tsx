/**
 * Collection Mode Page
 * 
 * Dedicated page for managing outstanding receivables and collection activities.
 * Provides a focused view of all clients who owe money with comprehensive tools.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { differenceInDays, format } from 'date-fns';
import {
  Phone,
  MessageSquare,
  Mail,
  DollarSign,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Calendar,
  Plus,
  Send,
  History,
  StickyNote,
  CreditCard
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';
import { formatCurrency, formatCompactCurrency } from '@/lib/formatters';
import { useRecordPayment } from '@/hooks/useRecordPayment';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { TruncatedText } from '@/components/shared/TruncatedText';
import { queryKeys } from '@/lib/queryKeys';

// Types
interface CollectionClient {
  id: string;
  name: string;
  businessName: string;
  amount: number;
  daysOverdue: number;
  lastContact?: Date;
  lastPaymentDate?: Date;
  phone?: string;
  email?: string;
  status: 'overdue' | 'due_this_week' | 'upcoming';
  paymentTerms: number;
  totalPaid: number;
  notes?: string;
}

interface CollectionActivity {
  id: string;
  clientId: string;
  type: 'call' | 'text' | 'email' | 'payment' | 'note' | 'reminder';
  notes?: string;
  amount?: number;
  createdAt: Date;
  performedBy?: string;
}

// Hook to fetch collection data
function useCollectionData() {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.collections.mode(tenant?.id),
    queryFn: async () => {
      const now = new Date();

      // Fetch clients with outstanding balance
      const { data: clients, error } = await supabase
        .from('wholesale_clients')
        .select(`
          id,
          business_name,
          contact_name,
          outstanding_balance,
          last_payment_date,
          payment_terms,
          phone,
          email,
          notes
        `)
        .eq('tenant_id', tenant?.id)
        .gt('outstanding_balance', 0)
        .order('outstanding_balance', { ascending: false });

      if (error) throw error;

      // Fetch total payments per client
      const { data: payments } = await supabase
        .from('wholesale_payments')
        .select('client_id, amount')
        .eq('tenant_id', tenant?.id);

      const paymentsByClient: Record<string, number> = {};
      payments?.forEach((p) => {
        paymentsByClient[p.client_id] = (paymentsByClient[p.client_id] ?? 0) + Number(p.amount ?? 0);
      });

      // Categorize clients
      const collectionClients: CollectionClient[] = (clients ?? []).map(c => {
        const daysSincePayment = c.last_payment_date
          ? differenceInDays(now, new Date(c.last_payment_date))
          : 999;
        const paymentTerms = c.payment_terms || 30;
        const isOverdue = daysSincePayment > paymentTerms;
        const isDueThisWeek = !isOverdue && daysSincePayment > paymentTerms - 7;

        let status: 'overdue' | 'due_this_week' | 'upcoming' = 'upcoming';
        if (isOverdue) status = 'overdue';
        else if (isDueThisWeek) status = 'due_this_week';

        return {
          id: c.id,
          name: c.contact_name || 'Unknown',
          businessName: c.business_name || 'Unknown Business',
          amount: Number(c.outstanding_balance ?? 0),
          daysOverdue: isOverdue ? daysSincePayment - paymentTerms : 0,
          lastContact: undefined,
          lastPaymentDate: c.last_payment_date ? new Date(c.last_payment_date) : undefined,
          phone: c.phone,
          email: c.email,
          status,
          paymentTerms,
          totalPaid: paymentsByClient[c.id] ?? 0,
          notes: c.notes
        };
      });

      // Calculate totals
      const overdue = collectionClients.filter(c => c.status === 'overdue');
      const dueThisWeek = collectionClients.filter(c => c.status === 'due_this_week');
      const upcoming = collectionClients.filter(c => c.status === 'upcoming');

      return {
        clients: collectionClients,
        totalOutstanding: collectionClients.reduce((sum, c) => sum + c.amount, 0),
        overdueAmount: overdue.reduce((sum, c) => sum + c.amount, 0),
        overdueCount: overdue.length,
        dueThisWeekAmount: dueThisWeek.reduce((sum, c) => sum + c.amount, 0),
        dueThisWeekCount: dueThisWeek.length,
        upcomingAmount: upcoming.reduce((sum, c) => sum + c.amount, 0),
        upcomingCount: upcoming.length
      };
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000
  });
}

// Hook to fetch activity history for a client
function useClientActivities(clientId: string | null) {
  const { tenant } = useTenantAdminAuth();

  return useQuery({
    queryKey: queryKeys.collections.activities(clientId),
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('collection_activities')
        .select('id, client_id, activity_type, notes, amount, created_at, performed_by')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        // Table might not exist, return empty
        logger.warn('Collection activities table not found', { error });
        return [];
      }

      return (data ?? []).map(a => ({
        id: a.id,
        clientId: a.client_id,
        type: a.activity_type as CollectionActivity['type'],
        notes: a.notes,
        amount: a.amount,
        createdAt: new Date(a.created_at),
        performedBy: a.performed_by
      }));
    },
    enabled: !!clientId && !!tenant?.id
  });
}

// Collection actions - now uses centralized payment service
function useCollectionActions() {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();
  const { recordPayment: recordPaymentService, isRecordingPayment } = useRecordPayment();

  const logActivity = useMutation({
    mutationFn: async (data: {
      clientId: string;
      type: CollectionActivity['type'];
      notes?: string;
      amount?: number;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;

      const { error } = await supabase
        .from('collection_activities')
        .insert({
          client_id: data.clientId,
          activity_type: data.type,
          notes: data.notes,
          amount: data.amount,
          performed_by: user?.id,
          tenant_id: tenant?.id
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.activities(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.mode() });
    }
  });

  // Use centralized payment service instead of direct DB operations
  const recordPayment = useMutation({
    mutationFn: async (data: {
      clientId: string;
      amount: number;
      notes?: string;
    }) => {
      // Use centralized payment service
      const result = await recordPaymentService({
        clientId: data.clientId,
        amount: data.amount,
        paymentMethod: 'cash',
        notes: data.notes,
        context: 'collection',
        showToast: false // We handle toast manually
      });

      if (!result.success) {
        throw new Error(result.error || 'Payment failed');
      }

      // Log activity for collection history
      await logActivity.mutateAsync({
        clientId: data.clientId,
        type: 'payment',
        amount: data.amount,
        notes: data.notes
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.mode() });
      toast.success('Payment recorded successfully');
    },
    onError: (error) => {
      logger.error('Failed to record payment', error);
      toast.error('Failed to record payment', { description: humanizeError(error) });
    }
  });

  const addNote = useMutation({
    mutationFn: async (data: { clientId: string; notes: string }) => {
      await logActivity.mutateAsync({
        clientId: data.clientId,
        type: 'note',
        notes: data.notes
      });
    },
    onSuccess: () => {
      toast.success('Note added');
    }
  });

  return { logActivity, recordPayment, addNote, isRecordingPayment };
}


// Client Card Component
interface ClientCardProps {
  client: CollectionClient;
  isExpanded: boolean;
  onToggle: () => void;
  onCall: () => void;
  onText: () => void;
  onEmail: () => void;
  onRecordPayment: () => void;
  onAddNote: () => void;
  isActivityPending: boolean;
  isPaymentPending: boolean;
}

function ClientCard({
  client,
  isExpanded,
  onToggle,
  onCall,
  onText,
  onEmail,
  onRecordPayment,
  onAddNote,
  isActivityPending,
  isPaymentPending
}: ClientCardProps) {
  const { data: activities, isLoading: activitiesLoading } = useClientActivities(isExpanded ? client.id : null);

  const statusColors = {
    overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
    due_this_week: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    upcoming: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  };

  const statusLabels = {
    overdue: 'Overdue',
    due_this_week: 'Due This Week',
    upcoming: 'Upcoming'
  };

  return (
    <Card className={cn(
      "bg-card border-border backdrop-blur-xl transition-all",
      isExpanded && "ring-1 ring-primary/30"
    )}>
      <CardContent className="p-4">
        {/* Main Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TruncatedText text={client.businessName} className="font-semibold text-foreground" />
              <Badge variant="outline" className={cn("text-xs", statusColors[client.status])}>
                {statusLabels[client.status]}
              </Badge>
            </div>
            <TruncatedText text={client.name} className="text-sm text-muted-foreground" as="p" />

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              {client.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {client.phone}
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1 max-w-[200px]">
                  <Mail className="h-3 w-3 shrink-0" />
                  <TruncatedText text={client.email} />
                </span>
              )}
            </div>

            {client.status === 'overdue' && client.daysOverdue > 0 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-red-400">
                <AlertCircle className="h-3 w-3" />
                {client.daysOverdue} days overdue
              </div>
            )}

            {client.lastPaymentDate && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Last payment: {format(client.lastPaymentDate, 'MMM d, yyyy')}
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="text-right flex-shrink-0">
            <div className={cn(
              "text-2xl font-bold font-mono",
              client.status === 'overdue' ? 'text-red-400' :
                client.status === 'due_this_week' ? 'text-amber-400' : 'text-emerald-400'
            )}>
              {formatCurrency(client.amount)}
            </div>
            <div className="text-xs text-muted-foreground">outstanding</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs hover:bg-emerald-500/20 hover:text-emerald-400"
            onClick={onCall}
            disabled={isActivityPending}
          >
            <Phone className="h-3.5 w-3.5 mr-1" />
            Call
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs hover:bg-blue-500/20 hover:text-blue-400"
            onClick={onText}
            disabled={isActivityPending}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Text
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs hover:bg-amber-500/20 hover:text-amber-400"
            onClick={onEmail}
            disabled={isActivityPending}
          >
            <Mail className="h-3.5 w-3.5 mr-1" />
            Email
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={onRecordPayment}
            disabled={isPaymentPending}
          >
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            Record Payment
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs border-border ml-auto"
            onClick={onToggle}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5 mr-1" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
                More
              </>
            )}
          </Button>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border space-y-4">
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="bg-muted/50 w-full justify-start">
                <TabsTrigger value="history" className="text-xs">
                  <History className="h-3.5 w-3.5 mr-1" />
                  History
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">
                  <StickyNote className="h-3.5 w-3.5 mr-1" />
                  Notes
                </TabsTrigger>
                <TabsTrigger value="payment-plan" className="text-xs">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Payment Plan
                </TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-3">
                {activitiesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full bg-muted/50" />
                    <Skeleton className="h-12 w-full bg-muted/50" />
                  </div>
                ) : activities && activities.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-2 rounded-lg bg-muted/30"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          activity.type === 'payment' ? 'bg-emerald-500/20' :
                            activity.type === 'call' ? 'bg-blue-500/20' :
                          activity.type === 'text' ? 'bg-purple-500/20' :
                                activity.type === 'email' ? 'bg-amber-500/20' :
                                  'bg-muted'
                        )}>
                          {activity.type === 'payment' && <DollarSign className="h-4 w-4 text-emerald-400" />}
                          {activity.type === 'call' && <Phone className="h-4 w-4 text-blue-400" />}
                          {activity.type === 'text' && <MessageSquare className="h-4 w-4 text-purple-400" />}
                          {activity.type === 'email' && <Mail className="h-4 w-4 text-amber-400" />}
                          {activity.type === 'note' && <StickyNote className="h-4 w-4 text-muted-foreground" />}
                          {activity.type === 'reminder' && <Send className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground capitalize">
                              {activity.type}
                              {activity.amount != null && ` - ${formatCurrency(activity.amount)}`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(activity.createdAt, 'MMM d, h:mm a')}
                            </span>
                          </div>
                          {activity.notes && (
                            <TruncatedText text={activity.notes} className="text-xs text-muted-foreground mt-1" as="p" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No activity history yet
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-3">
                <div className="space-y-3">
                  {client.notes && (
                    <div className="p-3 rounded-lg bg-muted/30 text-sm text-foreground">
                      {client.notes}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-border"
                    onClick={onAddNote}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="payment-plan" className="mt-3">
                <div className="text-center py-6">
                  <CreditCard className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">No payment plan set up</p>
                  <Button size="sm" variant="outline" className="border-border">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Payment Plan
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Record Payment Dialog
interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: CollectionClient | null;
  onSubmit: (amount: number, notes: string) => void;
  isLoading: boolean;
}

function RecordPaymentDialog({ open, onOpenChange, client, onSubmit, isLoading }: RecordPaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    onSubmit(numAmount, notes);
    setAmount('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment from {client?.businessName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="text-sm text-muted-foreground">Outstanding Balance</div>
            <div className="text-2xl font-bold text-red-400 font-mono">
              {formatCurrency(client?.amount ?? 0)}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 bg-muted border-border"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Payment notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-muted border-border min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isLoading ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add Note Dialog
interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: CollectionClient | null;
  onSubmit: (notes: string) => void;
  isLoading: boolean;
}

function AddNoteDialog({ open, onOpenChange, client, onSubmit, isLoading }: AddNoteDialogProps) {
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!notes.trim()) {
      toast.error('Please enter a note');
      return;
    }
    onSubmit(notes);
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle>Add Collection Note</DialogTitle>
          <DialogDescription>
            Add a note for {client?.businessName}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            placeholder="Enter your note..."
            aria-label="Collection note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-muted border-border min-h-[120px]"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Props for embedded mode
interface CollectionModeProps {
  embedded?: boolean;
}

// Main Component
export default function CollectionMode({ embedded = false }: CollectionModeProps) {
  const { navigateToAdmin } = useTenantNavigation();
  const { data, isLoading } = useCollectionData();
  const { logActivity, recordPayment, addNote } = useCollectionActions();

  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'due_this_week' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [paymentDialogClient, setPaymentDialogClient] = useState<CollectionClient | null>(null);
  const [noteDialogClient, setNoteDialogClient] = useState<CollectionClient | null>(null);

  // Filter clients based on active tab and search query
  const filteredClients = (data?.clients ?? []).filter(client => {
    const matchesTab = activeTab === 'all' || client.status === activeTab;
    const matchesSearch = !searchQuery.trim() ||
      client.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleCall = (client: CollectionClient) => {
    if (client.phone) {
      window.location.href = `tel:${client.phone}`;
      logActivity.mutate({ clientId: client.id, type: 'call' });
    } else {
      toast.error('No phone number available');
    }
  };

  const handleText = (client: CollectionClient) => {
    if (client.phone) {
      window.location.href = `sms:${client.phone}`;
      logActivity.mutate({ clientId: client.id, type: 'text' });
    } else {
      toast.error('No phone number available');
    }
  };

  const handleEmail = (client: CollectionClient) => {
    if (client.email) {
      const subject = encodeURIComponent(`Payment Reminder - ${client.businessName}`);
      const body = encodeURIComponent(`Hi ${client.name},\n\nThis is a friendly reminder about your outstanding balance of ${formatCurrency(client.amount)}.\n\nPlease let us know if you have any questions.\n\nThank you!`);
      window.location.href = `mailto:${client.email}?subject=${subject}&body=${body}`;
      logActivity.mutate({ clientId: client.id, type: 'email' });
    } else {
      toast.error('No email address available');
    }
  };

  const handleRecordPayment = (amount: number, notes: string) => {
    if (paymentDialogClient) {
      recordPayment.mutate({
        clientId: paymentDialogClient.id,
        amount,
        notes
      }, {
        onSuccess: () => {
          setPaymentDialogClient(null);
        }
      });
    }
  };

  const handleAddNote = (notes: string) => {
    if (noteDialogClient) {
      addNote.mutate({
        clientId: noteDialogClient.id,
        notes
      }, {
        onSuccess: () => {
          setNoteDialogClient(null);
        }
      });
    }
  };

  const columns: ResponsiveColumn<CollectionClient>[] = [
    {
      header: 'Client',
      cell: (client) => (
        <div>
          <div className="font-medium text-foreground">{client.businessName}</div>
          <div className="text-sm text-muted-foreground">{client.name}</div>
        </div>
      )
    },
    {
      header: 'Status',
      cell: (client) => {
        const statusColors = {
          overdue: 'bg-red-500/10 text-red-500 border-red-500/20',
          due_this_week: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
          upcoming: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
        };
        const statusLabels = {
          overdue: 'Overdue',
          due_this_week: 'Due This Week',
          upcoming: 'Upcoming'
        };
        return (
          <Badge variant="outline" className={statusColors[client.status]}>
            {statusLabels[client.status]}
          </Badge>
        );
      }
    },
    {
      header: 'Balance',
      className: 'text-right',
      cell: (client) => (
        <div className="text-right">
          <div className={cn(
            "font-mono font-bold",
            client.status === 'overdue' ? 'text-red-500' : 'text-foreground'
          )}>
            {formatCurrency(client.amount)}
          </div>
          {client.daysOverdue > 0 && (
            <div className="text-xs text-red-400">{client.daysOverdue} days overdue</div>
          )}
        </div>
      )
    },
    {
      header: 'Last Payment',
      className: 'text-right hidden md:table-cell',
      cell: (client) => (
        <div className="text-right text-sm text-muted-foreground">
          {client.lastPaymentDate ? format(client.lastPaymentDate, 'MMM d, yyyy') : '-'}
        </div>
      )
    },
    {
      header: '',
      className: 'text-right',
      cell: (client) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (expandedClientId === client.id) setExpandedClientId(null);
              else setExpandedClientId(client.id);
            }}
          >
            Details
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => setPaymentDialogClient(client)}
          >
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            Pay
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className={cn("min-h-dvh bg-background pb-20 md:pb-8", embedded && "min-h-0 pb-4")}>
      {/* Header - only show when not embedded */}
      {!embedded && (
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="container p-4">
            <div className="flex items-center gap-4 mb-4">
              <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('command-center')} aria-label="Back to command center">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <DollarSign className="h-6 w-6 text-primary" />
                  Collection Mode
                </h1>
                <p className="text-sm text-muted-foreground">Manage outstanding receivables</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      <div className={cn("container p-4", embedded && "px-0")}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground mb-1">Total Outstanding</div>
              <div className="text-lg font-bold font-mono text-foreground">
                {formatCompactCurrency(data?.totalOutstanding ?? 0)}
              </div>
            </CardContent>
          </Card>
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-3">
                <div className="text-xs text-red-400/80 mb-1">Overdue ({data?.overdueCount ?? 0})</div>
                <div className="text-lg font-bold font-mono text-red-500">
                  {formatCompactCurrency(data?.overdueAmount ?? 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/20">
              <CardContent className="p-3">
                <div className="text-xs text-amber-400/80 mb-1">Due Week ({data?.dueThisWeekCount ?? 0})</div>
                <div className="text-lg font-bold font-mono text-amber-500">
                  {formatCompactCurrency(data?.dueThisWeekAmount ?? 0)}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/10 border-emerald-500/20">
              <CardContent className="p-3">
                <div className="text-xs text-emerald-400/80 mb-1">Upcoming ({data?.upcomingCount ?? 0})</div>
                <div className="text-lg font-bold font-mono text-emerald-500">
                  {formatCompactCurrency(data?.upcomingAmount ?? 0)}
                </div>
              </CardContent>
            </Card>
          </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-end">
          <Tabs
            defaultValue="all"
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'all' | 'overdue' | 'due_this_week' | 'upcoming')}
            className="w-full md:w-auto"
          >
            <TabsList className="bg-muted border border-border w-full md:w-auto flex overflow-x-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="overdue" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
                Overdue
              </TabsTrigger>
              <TabsTrigger value="due_this_week" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                Due Soon
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                Upcoming
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="w-full md:w-72">
            <SearchInput
              defaultValue={searchQuery}
              onSearch={setSearchQuery}
              placeholder="Search clients..."
              className="bg-background/50 border-border"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container p-4">
        <ResponsiveTable
          columns={columns}
          data={filteredClients}
          isLoading={isLoading}
          keyExtractor={(client) => client.id}
          onRowClick={(_client) => {
            // For desktop table, maybe toggle details or navigation?
            // Leaving empty to rely on specific action buttons
          }}
          mobileRenderer={(client) => (
            <ClientCard
              client={client}
              isExpanded={expandedClientId === client.id}
              onToggle={() => setExpandedClientId(expandedClientId === client.id ? null : client.id)}
              onCall={() => handleCall(client)}
              onText={() => handleText(client)}
              onEmail={() => handleEmail(client)}
              onRecordPayment={() => setPaymentDialogClient(client)}
              onAddNote={() => setNoteDialogClient(client)}
              isActivityPending={logActivity.isPending}
              isPaymentPending={recordPayment.isPending}
            />
          )}
          emptyState={{
            icon: DollarSign,
            title: isLoading ? "Loading clients..." : "No clients found",
            description: "Try adjusting your filters or search query.",
            primaryAction: {
              label: "Clear Filters",
              onClick: () => { setSearchQuery(''); setActiveTab('all'); }
            }
          }}
        />
      </div>

      <RecordPaymentDialog
        open={!!paymentDialogClient}
        onOpenChange={(open) => !open && setPaymentDialogClient(null)}
        client={paymentDialogClient}
        onSubmit={handleRecordPayment}
        isLoading={false}
      />

      <AddNoteDialog
        open={!!noteDialogClient}
        onOpenChange={(open) => !open && setNoteDialogClient(null)}
        client={noteDialogClient}
        onSubmit={handleAddNote}
        isLoading={false}
      />
    </div>
  );
}
