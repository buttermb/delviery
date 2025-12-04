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
  FileText,
  Plus,
  Send,
  History,
  StickyNote,
  CreditCard,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useRecordPayment } from '@/hooks/useRecordPayment';

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

interface PaymentPlan {
  id: string;
  clientId: string;
  totalAmount: number;
  installments: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  startDate: Date;
  status: 'active' | 'completed' | 'cancelled';
}

// Hook to fetch collection data
function useCollectionData() {
  const { tenant } = useTenantAdminAuth();
  
  return useQuery({
    queryKey: ['collection-mode', tenant?.id],
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
      // @ts-ignore - Type instantiation too deep
      const { data: payments } = await supabase
        .from('wholesale_payments' as any)
        .select('client_id, amount')
        .eq('tenant_id', tenant?.id);
      
      const paymentsByClient: Record<string, number> = {};
      (payments as any[])?.forEach((p: any) => {
        paymentsByClient[p.client_id] = (paymentsByClient[p.client_id] || 0) + Number(p.amount || 0);
      });
      
      // Categorize clients
      const collectionClients: CollectionClient[] = (clients || []).map(c => {
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
          amount: Number(c.outstanding_balance || 0),
          daysOverdue: isOverdue ? daysSincePayment - paymentTerms : 0,
          lastContact: undefined,
          lastPaymentDate: c.last_payment_date ? new Date(c.last_payment_date) : undefined,
          phone: c.phone,
          email: c.email,
          status,
          paymentTerms,
          totalPaid: paymentsByClient[c.id] || 0,
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
    queryKey: ['collection-activities', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('collection_activities')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        // Table might not exist, return empty
        logger.warn('Collection activities table not found', { error });
        return [];
      }
      
      return (data || []).map(a => ({
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
      queryClient.invalidateQueries({ queryKey: ['collection-activities', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['collection-mode'] });
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
      queryClient.invalidateQueries({ queryKey: ['collection-mode'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error) => {
      logger.error('Failed to record payment', error);
      toast.error('Failed to record payment');
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

// Format currency
function formatCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
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
}

function ClientCard({ 
  client, 
  isExpanded, 
  onToggle,
  onCall,
  onText,
  onEmail,
  onRecordPayment,
  onAddNote
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
      "bg-zinc-900/80 border-zinc-800/50 backdrop-blur-xl transition-all",
      isExpanded && "ring-1 ring-emerald-500/30"
    )}>
      <CardContent className="p-4">
        {/* Main Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-zinc-100 truncate">{client.businessName}</h3>
              <Badge variant="outline" className={cn("text-xs", statusColors[client.status])}>
                {statusLabels[client.status]}
              </Badge>
            </div>
            <p className="text-sm text-zinc-400 truncate">{client.name}</p>
            
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-500">
              {client.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {client.phone}
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1 truncate max-w-[200px]">
                  <Mail className="h-3 w-3" />
                  {client.email}
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
              <div className="flex items-center gap-1 mt-1 text-xs text-zinc-500">
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
              ${client.amount.toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500">outstanding</div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-zinc-800">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 px-2 text-xs hover:bg-emerald-500/20 hover:text-emerald-400"
            onClick={onCall}
          >
            <Phone className="h-3.5 w-3.5 mr-1" />
            Call
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 px-2 text-xs hover:bg-blue-500/20 hover:text-blue-400"
            onClick={onText}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" />
            Text
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 px-2 text-xs hover:bg-amber-500/20 hover:text-amber-400"
            onClick={onEmail}
          >
            <Mail className="h-3.5 w-3.5 mr-1" />
            Email
          </Button>
          <Button 
            size="sm" 
            variant="default" 
            className="h-8 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={onRecordPayment}
          >
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            Record Payment
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 px-2 text-xs border-zinc-700 ml-auto"
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
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4">
            <Tabs defaultValue="history" className="w-full">
              <TabsList className="bg-zinc-800/50 w-full justify-start">
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
                    <Skeleton className="h-12 w-full bg-zinc-800/50" />
                    <Skeleton className="h-12 w-full bg-zinc-800/50" />
                  </div>
                ) : activities && activities.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activities.map((activity) => (
                      <div 
                        key={activity.id}
                        className="flex items-start gap-3 p-2 rounded-lg bg-zinc-800/30"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          activity.type === 'payment' ? 'bg-emerald-500/20' :
                          activity.type === 'call' ? 'bg-blue-500/20' :
                          activity.type === 'text' ? 'bg-purple-500/20' :
                          activity.type === 'email' ? 'bg-amber-500/20' :
                          'bg-zinc-700'
                        )}>
                          {activity.type === 'payment' && <DollarSign className="h-4 w-4 text-emerald-400" />}
                          {activity.type === 'call' && <Phone className="h-4 w-4 text-blue-400" />}
                          {activity.type === 'text' && <MessageSquare className="h-4 w-4 text-purple-400" />}
                          {activity.type === 'email' && <Mail className="h-4 w-4 text-amber-400" />}
                          {activity.type === 'note' && <StickyNote className="h-4 w-4 text-zinc-400" />}
                          {activity.type === 'reminder' && <Send className="h-4 w-4 text-zinc-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-zinc-200 capitalize">
                              {activity.type}
                              {activity.amount && ` - $${activity.amount.toLocaleString()}`}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {format(activity.createdAt, 'MMM d, h:mm a')}
                            </span>
                          </div>
                          {activity.notes && (
                            <p className="text-xs text-zinc-400 mt-1 truncate">{activity.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-zinc-500 text-sm">
                    No activity history yet
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="notes" className="mt-3">
                <div className="space-y-3">
                  {client.notes && (
                    <div className="p-3 rounded-lg bg-zinc-800/30 text-sm text-zinc-300">
                      {client.notes}
                    </div>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full border-zinc-700"
                    onClick={onAddNote}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="payment-plan" className="mt-3">
                <div className="text-center py-6">
                  <CreditCard className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                  <p className="text-sm text-zinc-500 mb-3">No payment plan set up</p>
                  <Button size="sm" variant="outline" className="border-zinc-700">
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
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment from {client?.businessName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-zinc-800/50">
            <div className="text-sm text-zinc-400">Outstanding Balance</div>
            <div className="text-2xl font-bold text-red-400 font-mono">
              ${client?.amount.toLocaleString() || 0}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Payment Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Payment notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-zinc-800 border-zinc-700 min-h-[80px]"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zinc-700">
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
      <DialogContent className="bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle>Add Collection Note</DialogTitle>
          <DialogDescription>
            Add a note for {client?.businessName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Textarea
            placeholder="Enter your note..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-zinc-800 border-zinc-700 min-h-[120px]"
          />
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-zinc-700">
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

// Main Component
export default function CollectionMode() {
  const { navigateToAdmin } = useTenantNavigation();
  const { data, isLoading } = useCollectionData();
  const { logActivity, recordPayment, addNote } = useCollectionActions();
  
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'due_this_week' | 'upcoming'>('all');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [paymentDialogClient, setPaymentDialogClient] = useState<CollectionClient | null>(null);
  const [noteDialogClient, setNoteDialogClient] = useState<CollectionClient | null>(null);
  
  // Filter clients based on active tab
  const filteredClients = data?.clients.filter(client => {
    if (activeTab === 'all') return true;
    return client.status === activeTab;
  }) || [];
  
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
      const body = encodeURIComponent(`Hi ${client.name},\n\nThis is a friendly reminder about your outstanding balance of $${client.amount.toLocaleString()}.\n\nPlease let us know if you have any questions.\n\nThank you!`);
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
  
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-10 w-48 bg-zinc-800/50" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 bg-zinc-800/50" />
          <Skeleton className="h-24 bg-zinc-800/50" />
          <Skeleton className="h-24 bg-zinc-800/50" />
          <Skeleton className="h-24 bg-zinc-800/50" />
        </div>
        <Skeleton className="h-[400px] bg-zinc-800/50" />
      </div>
    );
  }
  
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigateToAdmin('command-center')}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Collection Mode</h1>
            <p className="text-sm text-zinc-400">Manage outstanding receivables</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-zinc-400">Total Outstanding</div>
          <div className="text-3xl font-bold text-red-400 font-mono">
            ${data?.totalOutstanding.toLocaleString() || 0}
          </div>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-zinc-900/80 border-zinc-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-zinc-400 uppercase">Overdue</span>
            </div>
            <div className="text-2xl font-bold text-red-400 font-mono">
              {formatCurrency(data?.overdueAmount || 0)}
            </div>
            <div className="text-xs text-zinc-500">{data?.overdueCount || 0} clients</div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/80 border-zinc-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-zinc-400 uppercase">Due This Week</span>
            </div>
            <div className="text-2xl font-bold text-amber-400 font-mono">
              {formatCurrency(data?.dueThisWeekAmount || 0)}
            </div>
            <div className="text-xs text-zinc-500">{data?.dueThisWeekCount || 0} clients</div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/80 border-zinc-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-400 uppercase">Upcoming</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {formatCurrency(data?.upcomingAmount || 0)}
            </div>
            <div className="text-xs text-zinc-500">{data?.upcomingCount || 0} clients</div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/80 border-zinc-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
              <span className="text-xs text-zinc-400 uppercase">Total Clients</span>
            </div>
            <div className="text-2xl font-bold text-zinc-100 font-mono">
              {data?.clients.length || 0}
            </div>
            <div className="text-xs text-zinc-500">with balance</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filter Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-zinc-800/50">
          <TabsTrigger value="all">
            All ({data?.clients.length || 0})
          </TabsTrigger>
          <TabsTrigger value="overdue" className="text-red-400 data-[state=active]:text-red-400">
            Overdue ({data?.overdueCount || 0})
          </TabsTrigger>
          <TabsTrigger value="due_this_week" className="text-amber-400 data-[state=active]:text-amber-400">
            Due This Week ({data?.dueThisWeekCount || 0})
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="text-emerald-400 data-[state=active]:text-emerald-400">
            Upcoming ({data?.upcomingCount || 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Client List */}
      <div className="space-y-3">
        {filteredClients.length === 0 ? (
          <Card className="bg-zinc-900/80 border-zinc-800/50">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
              <h3 className="text-lg font-semibold text-zinc-100 mb-1">All caught up!</h3>
              <p className="text-sm text-zinc-400">
                {activeTab === 'all' 
                  ? 'No outstanding balances to collect'
                  : `No ${activeTab.replace('_', ' ')} balances`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredClients.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              isExpanded={expandedClientId === client.id}
              onToggle={() => setExpandedClientId(
                expandedClientId === client.id ? null : client.id
              )}
              onCall={() => handleCall(client)}
              onText={() => handleText(client)}
              onEmail={() => handleEmail(client)}
              onRecordPayment={() => setPaymentDialogClient(client)}
              onAddNote={() => setNoteDialogClient(client)}
            />
          ))
        )}
      </div>
      
      {/* Dialogs */}
      <RecordPaymentDialog
        open={!!paymentDialogClient}
        onOpenChange={(open) => !open && setPaymentDialogClient(null)}
        client={paymentDialogClient}
        onSubmit={handleRecordPayment}
        isLoading={recordPayment.isPending}
      />
      
      <AddNoteDialog
        open={!!noteDialogClient}
        onOpenChange={(open) => !open && setNoteDialogClient(null)}
        client={noteDialogClient}
        onSubmit={handleAddNote}
        isLoading={addNote.isPending}
      />
    </div>
  );
}


