import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Package, DollarSign, TrendingUp, AlertTriangle,
  Eye, CreditCard, MessageCircle, Calendar
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface FrontedItem {
  id: string;
  fronted_to_customer_name?: string;
  fronted_to_user_id?: string;
  dispatched_at: string;
  payment_due_date: string;
  expected_revenue: number;
  expected_profit: number;
  payment_received: number;
  payment_status: string;
  status: string;
  quantity_fronted: number;
  quantity_sold: number;
  quantity_returned: number;
  quantity_damaged: number;
  product: {
    name: string;
  };
}

export default function FrontedInventory() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const { toast } = useToast();
  const [frontedItems, setFrontedItems] = useState<FrontedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (account) {
      loadFrontedInventory();
    }
  }, [account, filter]);

  const loadFrontedInventory = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('fronted_inventory')
        .select(`
          *,
          product:products(name)
        `);

      // Only filter by account_id if account exists
      if (account?.id) {
        query = query.eq('account_id', account.id);
      }

      if (filter === 'pending') {
        query = query.eq('payment_status', 'pending');
      } else if (filter === 'overdue') {
        query = query.eq('payment_status', 'overdue');
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed');
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading fronted inventory:', error);
        toast({
          title: 'Database Error',
          description: `Failed to load fronted inventory: ${error.message}`,
          variant: 'destructive'
        });
        return;
      }
      
      setFrontedItems(data || []);
    } catch (error: any) {
      console.error('Unexpected error loading fronted inventory:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please check your connection.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getPaymentStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && status !== 'paid';

    if (status === 'paid') {
      return <Badge className="bg-green-500">Paid</Badge>;
    } else if (isOverdue) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else if (status === 'partial') {
      return <Badge variant="secondary">Partial</Badge>;
    } else {
      return <Badge variant="outline">Pending</Badge>;
    }
  };

  const calculateOverview = () => {
    const active = frontedItems.filter(i => i.status === 'active');
    return {
      totalOut: active.reduce((sum, i) => sum + i.quantity_fronted, 0),
      expectedRevenue: active.reduce((sum, i) => sum + (i.expected_revenue || 0), 0),
      expectedProfit: active.reduce((sum, i) => sum + (i.expected_profit || 0), 0),
      totalOwed: active.reduce((sum, i) => sum + ((i.expected_revenue || 0) - i.payment_received), 0),
      overdueCount: active.filter(i => new Date(i.payment_due_date) < new Date() && i.payment_status !== 'paid').length
    };
  };

  const overview = calculateOverview();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Fronted Inventory | Inventory Management"
        description="Track fronted and consignment inventory"
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">📊 Fronted Inventory Tracking</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/inventory/barcodes')}>
              Generate Barcodes
            </Button>
            <Button onClick={() => navigate('/admin/inventory/dispatch')}>
              + New Front
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalOut}</div>
              <p className="text-xs text-muted-foreground">units fronted</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expected</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${overview.expectedRevenue.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${overview.expectedProfit.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">expected</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Owed</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">${overview.totalOwed.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">{overview.overdueCount} overdue</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Tabs defaultValue="all" onValueChange={setFilter} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending Payment</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Fronted Items List */}
        <div className="space-y-4">
          {frontedItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Fronted Inventory</h3>
                <p className="text-muted-foreground mb-4">
                  Start by fronting inventory to drivers or locations
                </p>
                <Button onClick={() => navigate('/admin/inventory/dispatch')}>
                  + Front Products
                </Button>
              </CardContent>
            </Card>
          ) : (
            frontedItems.map((item) => {
              const amountOwed = (item.expected_revenue || 0) - item.payment_received;
              const percentSold = (item.quantity_sold / item.quantity_fronted) * 100;

              return (
                <Card key={item.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold">
                            {item.fronted_to_customer_name || 'Unknown Customer'}
                          </h3>
                          {getPaymentStatusBadge(item.payment_status, item.payment_due_date)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <Calendar className="inline h-3 w-3 mr-1" />
                          Dispatched: {format(new Date(item.dispatched_at), 'MMM d, yyyy')} |
                          Due: {format(new Date(item.payment_due_date), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/admin/inventory/fronted/${item.id}`)}>
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Expected Revenue</p>
                        <p className="text-2xl font-bold">${item.expected_revenue?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Expected Profit</p>
                        <p className="text-2xl font-bold text-green-600">${item.expected_profit?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Amount Owed</p>
                        <p className="text-2xl font-bold text-red-600">${amountOwed.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Inventory Status</span>
                        <span>{item.quantity_sold}/{item.quantity_fronted} sold ({percentSold.toFixed(0)}%)</span>
                      </div>
                      <Progress value={percentSold} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>• Sold: {item.quantity_sold}</span>
                        <span>• Unsold: {item.quantity_fronted - item.quantity_sold - item.quantity_returned - item.quantity_damaged}</span>
                        <span>• Returned: {item.quantity_returned}</span>
                        <span>• Damaged: {item.quantity_damaged}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => navigate(`/admin/inventory/fronted/${item.id}/payment`)}>
                        <CreditCard className="h-4 w-4 mr-1" />
                        Record Payment
                      </Button>
                      <Button variant="outline" size="sm">
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Contact
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
