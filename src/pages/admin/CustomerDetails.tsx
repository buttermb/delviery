import { logger } from '@/lib/logger';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { useEncryption } from '@/lib/hooks/useEncryption';
import { decryptCustomerData, logPHIAccess, getPHIFields } from '@/lib/utils/customerEncryption';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft, User, Mail, Phone, MapPin, Calendar,
  DollarSign, Star, ShoppingBag, CreditCard, Gift, MessageSquare, Shield
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SEOHead } from '@/components/SEOHead';
import { format } from 'date-fns';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { ActivityTimeline } from '@/components/crm/ActivityTimeline';
import { CommunicationHistory } from '@/components/crm/CommunicationHistory';
import { ContactCard } from '@/components/crm/ContactCard';
import { SwipeBackWrapper } from '@/components/mobile/SwipeBackWrapper';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { CustomerInvoicesTab } from '@/components/admin/customers/CustomerInvoicesTab';

interface Customer {
  id: string;
  account_id: string;
  tenant_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  customer_type: string;
  date_of_birth: string;
  address: string;
  city?: string;
  state?: string;
  medical_card_number?: string;
  medical_card_expiration?: string;
  total_spent: number;
  loyalty_points: number;
  last_purchase_at: string;
  created_at: string;
}

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const { isReady: encryptionIsReady } = useEncryption();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [storeCredit, setStoreCredit] = useState(0);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [storeCreditDialogOpen, setStoreCreditDialogOpen] = useState(false);
  const [storeCreditAmount, setStoreCreditAmount] = useState('');

  // Get tenant_id from tenant context or customer data
  const tenantId = tenant?.id || customer?.tenant_id;

  useEffect(() => {
    if (id) {
      loadCustomerData();
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadCustomerData = async () => {
    try {
      // Load customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId) // Ensure customer belongs to current tenant
        .maybeSingle();

      if (customerError) throw customerError;

      // Customer data is NOT encrypted - use plaintext fields directly
      setCustomer(customerData as Customer);

      // Load orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            products(name, price)
          )
        `)
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Load payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

      // Load notes
      const { data: notesData, error: notesError } = await supabase
        .from('customer_notes')
        .select(`
          *,
          profiles:created_by(full_name)
        `)
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;
      setNotes(notesData || []);

      // Load store credit balance
      const { data: creditData } = await supabase
        .from('customer_credits')
        .select('amount, transaction_type')
        .eq('customer_id', id)
        .eq('tenant_id', tenantId);

      if (creditData) {
        const totalCredit = creditData.reduce((sum, credit) => {
          if (credit.transaction_type === 'issued' || credit.transaction_type === 'refund') {
            return sum + (credit.amount || 0);
          } else if (credit.transaction_type === 'used') {
            return sum - (credit.amount || 0);
          }
          return sum;
        }, 0);
        setStoreCredit(Math.max(0, totalCredit));
      }

      // Calculate outstanding balance (total orders - total payments)
      const ordersTotal = (ordersData || []).reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const paymentsTotal = (paymentsData || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
      setOutstandingBalance(Math.max(0, ordersTotal - paymentsTotal));
    } catch (error) {
      logger.error('Error loading customer data', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerDetails' });
      toast.error('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    try {
      const { error } = await supabase.from('customer_notes').insert({
        account_id: customer?.account_id || '',
        customer_id: id || '',
        note: newNote,
        note_type: 'general'
      });

      if (error) throw error;

      toast.success('Note added successfully');
      setNewNote('');
      loadCustomerData();
    } catch (error) {
      logger.error('Error adding note', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerDetails' });
      toast.error('Failed to add note');
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p>Customer not found</p>
      </div>
    );
  }

  const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <SwipeBackWrapper onBack={() => navigateToAdmin('customer-management')}>
      <div className="min-h-dvh bg-gray-50 p-6">
        <SEOHead title={`${customer.first_name} ${customer.last_name} | Customer Details`} />

        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="mb-8">
            <Button variant="ghost" onClick={() => navigateToAdmin('customer-management')} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Customers
            </Button>

            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                  <User className="w-10 h-10 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {customer.first_name} {customer.last_name}
                    </h1>
                    <Badge
                      className={customer.customer_type === 'medical'
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                      }
                    >
                      {customer.customer_type === 'medical' ? '🏥 Medical' : 'Recreational'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {customer.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {customer.phone}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Member since {format(new Date(customer.created_at), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => navigateToAdmin(`customer-management/${id}/edit`)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Edit Profile
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[hsl(var(--tenant-text-light))] mb-1">Total Spent</p>
                    <p className="text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">
                      ${customer.total_spent?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[hsl(var(--tenant-text-light))] mb-1">Total Orders</p>
                    <p className="text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">{orders.length}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <ShoppingBag className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[hsl(var(--tenant-text-light))] mb-1">Loyalty Points</p>
                    <p className="text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">{customer.loyalty_points || 0}</p>
                  </div>
                  <div className="p-3 bg-emerald-100 rounded-lg">
                    <Gift className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[hsl(var(--tenant-text-light))] mb-1">Average Order</p>
                    <p className="text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">
                      ${orders.length > 0 ? ((customer.total_spent || 0) / orders.length).toFixed(2) : '0.00'}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Star className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-[hsl(var(--tenant-bg))] border border-[hsl(var(--tenant-border))]">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="orders">Purchase History</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="communications">Communications</TabsTrigger>
              <TabsTrigger value="financial">Financial Tracking</TabsTrigger>
              <TabsTrigger value="medical">Medical Info</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Contact Card and Activity Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {tenantId && customer && (
                  <ContactCard
                    customer={customer}
                    customerId={customer.id}
                    tenantId={tenantId}
                    onCall={() => {
                      if (customer.phone) {
                        window.location.href = `tel:${customer.phone}`;
                      }
                    }}
                    onEmail={() => {
                      if (customer.email) {
                        window.location.href = `mailto:${customer.email}`;
                      }
                    }}
                    onMessage={() => {
                      // Scroll to communication history or open dialog
                      const commTab = document.querySelector('[value="communications"]');
                      if (commTab) {
                        (commTab as HTMLElement).click();
                      }
                    }}
                  />
                )}
                {tenantId && customer && (
                  <div className="lg:col-span-2">
                    <ActivityTimeline clientId={customer.id} />
                  </div>
                )}
              </div>

              {/* Communication History */}
              {tenantId && customer && (
                <CommunicationHistory
                  customerId={customer.id}
                  tenantId={tenantId}
                  customerEmail={customer.email}
                  customerPhone={customer.phone}
                />
              )}

              {/* Legacy Account Info (keep for backward compatibility) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Account Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                      <p>{customer.date_of_birth ? format(new Date(customer.date_of_birth), 'MMM d, yyyy') : 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Address</label>
                      <p>{customer.address || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Customer Type</label>
                      <Badge variant="outline">{customer.customer_type}</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Account Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Purchase</label>
                      <p>{customer.last_purchase_at ? format(new Date(customer.last_purchase_at), 'MMM d, yyyy') : 'Never'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Total Orders</label>
                      <p>{orders.length} orders</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Average Order Value</label>
                      <p>${orders.length > 0 ? ((customer.total_spent || 0) / orders.length).toFixed(2) : '0.00'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Loyalty Status</label>
                      <Badge className={
                        (customer.loyalty_points || 0) >= 1000 ? 'bg-amber-100 text-amber-800' :
                          (customer.loyalty_points || 0) >= 500 ? 'bg-purple-100 text-purple-800' :
                            (customer.loyalty_points || 0) >= 100 ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                      }>
                        {(customer.loyalty_points || 0) >= 1000 ? '⭐ VIP' :
                          (customer.loyalty_points || 0) >= 500 ? '🥇 Gold' :
                            (customer.loyalty_points || 0) >= 100 ? '🥈 Silver' :
                              '🥉 Bronze'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Purchase History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {orders.length === 0 ? (
                      <EnhancedEmptyState
                        icon={ShoppingBag}
                        title="No Orders Yet"
                        description="This customer hasn't placed any orders yet."
                        compact
                      />
                    ) : (
                      orders.map(order => (
                        <div key={order.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">${order.total_amount?.toFixed(2)}</p>
                              <Badge variant={order.status === 'completed' ? 'default' : 'secondary'}>
                                {order.status}
                              </Badge>
                            </div>
                          </div>
                          <Separator className="my-3" />
                          <div className="space-y-2">
                            {order.order_items?.map((item: any) => (
                              <div key={item.id} className="flex justify-between text-sm">
                                <span>{item.products?.name} x{item.quantity}</span>
                                <span>${item.subtotal?.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigateToAdmin(`customers/${id}/invoices`)}
                            >
                              View Invoice
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                toast.success("Items added to cart");
                                navigateToAdmin(`pos?customer=${id}&reorder=${order.id}`);
                              }}
                            >
                              Reorder
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoices Tab */}
            {customer && (
              <TabsContent value="invoices">
                <CustomerInvoicesTab
                  customerId={customer.id}
                  onCreateInvoice={() => navigateToAdmin(`customers/${id}/invoices`)}
                />
              </TabsContent>
            )}

            {/* Communications Tab */}
            {tenantId && customer && (
              <TabsContent value="communications" className="space-y-6">
                <CommunicationHistory
                  customerId={customer.id}
                  tenantId={tenantId}
                  customerEmail={customer.email}
                  customerPhone={customer.phone}
                />
              </TabsContent>
            )}

            {/* Financial Tab */}
            <TabsContent value="financial">
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Total Lifetime Payments</p>
                        <p className="text-2xl font-bold">${totalPayments.toFixed(2)}</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Store Credit</p>
                        <p className="text-2xl font-bold text-green-600">${storeCredit.toFixed(2)}</p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                        <p className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-red-600' : ''}`}>
                          ${outstandingBalance.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {payments.length === 0 ? (
                        <EnhancedEmptyState
                          icon={CreditCard}
                          title="No Payments Recorded"
                          description="No payment history for this customer."
                          compact
                        />
                      ) : (
                        payments.map(payment => (
                          <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <CreditCard className="w-5 h-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">${payment.amount?.toFixed(2)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(payment.created_at), 'MMM d, yyyy')} · {payment.payment_method}
                                </p>
                              </div>
                            </div>
                            <Badge variant={payment.payment_status === 'completed' ? 'default' : 'secondary'}>
                              {payment.payment_status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => navigateToAdmin(`inventory/fronted/record-payment?customer=${id}`)}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Record Payment
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setStoreCreditDialogOpen(true)}
                      >
                        Add Store Credit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => navigateToAdmin(`customers/${id}/invoices`)}
                      >
                        Create Invoice
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Medical Tab */}
            <TabsContent value="medical">
              <Card>
                <CardHeader>
                  <CardTitle>Medical Information</CardTitle>
                </CardHeader>
                <CardContent>
                  {customer.customer_type === 'medical' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Medical Card Number</label>
                        <p className="text-lg">{customer.medical_card_number || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Card Expiration</label>
                        <p className="text-lg">
                          {customer.medical_card_expiration
                            ? format(new Date(customer.medical_card_expiration), 'MMM d, yyyy')
                            : 'N/A'
                          }
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium mb-2">Qualifying Conditions</p>
                        <p className="text-muted-foreground">Not specified</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Physician Information</p>
                        <p className="text-muted-foreground">Not specified</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      This is a recreational customer
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Add Note</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Add a note about this customer..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={4}
                    />
                    <Button onClick={addNote}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Add Note
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notes History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {notes.length === 0 ? (
                      <EnhancedEmptyState
                        icon={MessageSquare}
                        title="No Notes Yet"
                        description="Add the first note about this customer."
                        compact
                      />
                    ) : (
                      notes.map(note => (
                        <div key={note.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-medium">
                              {note.profiles?.full_name || 'Staff Member'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                          <p className="text-sm">{note.note}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Store Credit Dialog */}
      <Dialog open={storeCreditDialogOpen} onOpenChange={setStoreCreditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Store Credit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                placeholder="Enter credit amount"
                value={storeCreditAmount}
                onChange={(e) => setStoreCreditAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setStoreCreditDialogOpen(false);
                setStoreCreditAmount('');
              }}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (storeCreditAmount && !isNaN(parseFloat(storeCreditAmount))) {
                    try {
                      const { error } = await supabase.from('customer_credits').insert({
                        tenant_id: tenant?.id,
                        customer_id: id,
                        amount: parseFloat(storeCreditAmount),
                        transaction_type: 'issued',
                        reason: 'Manual credit issued by admin'
                      });
                      if (error) throw error;
                      toast.success(`$${storeCreditAmount} store credit added`);
                      setStoreCreditDialogOpen(false);
                      setStoreCreditAmount('');
                      loadCustomerData();
                    } catch (error) {
                      logger.error('Failed to add store credit', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerDetails' });
                      toast.error('Failed to add store credit');
                    }
                  }
                }}
                disabled={!storeCreditAmount || isNaN(parseFloat(storeCreditAmount))}
              >
                Add Credit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SwipeBackWrapper>
  );
}
