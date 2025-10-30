import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, User, Mail, Phone, MapPin, Calendar, 
  DollarSign, Star, ShoppingBag, CreditCard, Gift, MessageSquare 
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { format } from 'date-fns';

interface Customer {
  id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  customer_type: string;
  date_of_birth: string;
  address: string;
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
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadCustomerData();
    }
  }, [id]);

  const loadCustomerData = async () => {
    try {
      // Load customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

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
    } catch (error) {
      console.error('Error loading customer data:', error);
      toast({ title: 'Error loading customer', variant: 'destructive' });
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

      toast({ title: 'Note added successfully' });
      setNewNote('');
      loadCustomerData();
    } catch (error) {
      console.error('Error adding note:', error);
      toast({ title: 'Error adding note', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Customer not found</p>
      </div>
    );
  }

  const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <SEOHead title={`${customer.first_name} ${customer.last_name} | Customer Details`} />

      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/customer-management')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Customers
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-10 h-10 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">
                  {customer.first_name} {customer.last_name}
                </h1>
                <Badge variant={customer.customer_type === 'medical' ? 'default' : 'secondary'}>
                  {customer.customer_type === 'medical' ? 'Medical Patient' : 'Recreational'}
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

          <Button>Edit Profile</Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">${customer.total_spent?.toFixed(2) || '0.00'}</p>
                <p className="text-xs text-muted-foreground">Total Spent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-xs text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Gift className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{customer.loyalty_points || 0}</p>
                <p className="text-xs text-muted-foreground">Loyalty Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">VIP</p>
                <p className="text-xs text-muted-foreground">Customer Tier</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Purchase History</TabsTrigger>
          <TabsTrigger value="financial">Financial Tracking</TabsTrigger>
          <TabsTrigger value="medical">Medical Info</TabsTrigger>
          <TabsTrigger value="notes">Notes & Preferences</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p>{customer.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p>{customer.phone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                  <p>{customer.date_of_birth ? format(new Date(customer.date_of_birth), 'MMM d, yyyy') : 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p>{customer.address || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Activity</CardTitle>
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
                  <Badge>VIP Member</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Purchase History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No orders yet</p>
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
                        <Button size="sm" variant="outline">View Invoice</Button>
                        <Button size="sm" variant="outline">Reorder</Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                    <p className="text-2xl font-bold">$0.00</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                    <p className="text-2xl font-bold">$0.00</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  {payments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No payments recorded</p>
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
                  <Button variant="outline">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Record Payment
                  </Button>
                  <Button variant="outline">Add Store Credit</Button>
                  <Button variant="outline">Create Invoice</Button>
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
                  <p className="text-center text-muted-foreground py-8">No notes yet</p>
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
  );
}
