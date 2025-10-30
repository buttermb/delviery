import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  CreditCard, Download, FileText, CheckCircle,
  AlertCircle, Calendar, DollarSign
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  created_at: string;
  due_date: string;
}

export default function BillingPortal() {
  const navigate = useNavigate();
  const { account, accountSettings, loading: accountLoading } = useAccount();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (!accountLoading && !account) {
      navigate('/admin/dashboard');
    }
  }, [account, accountLoading, navigate]);

  useEffect(() => {
    if (account) {
      loadBillingData();
    }
  }, [account]);

  const loadBillingData = async () => {
    try {
      // Load subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:plans(*)
        `)
        .eq('account_id', account?.id)
        .single();

      if (subData) {
        setSubscription(subData);
      }

      // Placeholder invoices - replace with actual data
      setInvoices([
        {
          id: '1',
          invoice_number: 'INV-2024-001',
          amount: 299.00,
          status: 'paid',
          created_at: new Date().toISOString(),
          due_date: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      paid: { variant: 'default', icon: CheckCircle },
      pending: { variant: 'secondary', icon: AlertCircle },
      overdue: { variant: 'destructive', icon: AlertCircle }
    };

    const { variant, icon: Icon } = variants[status] || variants.pending;

    return (
      <Badge variant={variant} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  if (accountLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Billing & Subscriptions"
        description="Manage your billing and subscription"
      />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Billing & Subscriptions</h1>
          <p className="text-muted-foreground mt-2">Manage your subscription and billing information</p>
        </div>

        {/* Current Plan */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your active subscription details</CardDescription>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold">{subscription.plan?.name || 'Professional'}</h3>
                    <Badge>{subscription.status}</Badge>
                  </div>
                  <p className="text-muted-foreground mb-4">
                    ${subscription.plan?.price_monthly || '299'}/month
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Button onClick={() => navigate('/pricing')}>
                    Change Plan
                  </Button>
                  <Button variant="outline">
                    Cancel Subscription
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No active subscription</p>
                <Button onClick={() => navigate('/pricing')}>
                  View Plans
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="invoices" className="w-full">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
            <TabsTrigger value="billing-info">Billing Information</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invoice History</CardTitle>
                <CardDescription>View and download your invoices</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{new Date(invoice.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment-methods" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Manage your payment methods</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">•••• •••• •••• 4242</p>
                        <p className="text-sm text-muted-foreground">Expires 12/2025</p>
                      </div>
                      <Badge>Default</Badge>
                    </div>
                    <Button variant="ghost">Edit</Button>
                  </div>
                  <Button variant="outline" className="w-full">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Add Payment Method
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing-info" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Billing Information</CardTitle>
                <CardDescription>Update your billing details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Company Name</p>
                    <p className="font-medium">{account?.company_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Billing Email</p>
                    <p className="font-medium">{account?.billing_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tax ID</p>
                    <p className="font-medium">{accountSettings?.business_license || 'Not provided'}</p>
                  </div>
                  <Button variant="outline">
                    Edit Billing Information
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
