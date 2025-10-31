/**
 * 💼 BIG PLUG CRM - Client Management
 * B2B focused with credit tracking, reliability scores, territory management
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, Search, Phone, MessageSquare, DollarSign, Package,
  Star, AlertCircle, Filter, Download, MapPin, TrendingUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '@/contexts/AccountContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function BigPlugClientManagement() {
  const navigate = useNavigate();
  const { account } = useAccount();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('outstanding_credit');

  const { data: clients, isLoading } = useQuery({
    queryKey: ['big-plug-clients', account?.id, filter],
    queryFn: async () => {
      if (!account?.id) return [];

      let query = supabase
        .from('wholesale_clients')
        .select(`
          *,
          wholesale_orders(id, total_amount, created_at, status, payment_status),
          wholesale_payments(amount, payment_date)
        `)
        .eq('account_id', account.id)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filter === 'active') {
        query = query.eq('status', 'active');
      } else if (filter === 'credit_approved') {
        query = query.gt('credit_limit', 0);
      } else if (filter === 'overdue') {
        query = query.gt('outstanding_balance', 10000);
      } else if (filter === 'top_spenders') {
        // Will sort by total spent after fetch
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calculate metrics for each client
      return (data || []).map(client => {
        const orders = client.wholesale_orders || [];
        const payments = client.wholesale_payments || [];
        
        const paidOrders = orders.filter(o => o.status === 'delivered');
        const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
        const thisMonthOrders = orders.filter(o => {
          const orderDate = new Date(o.created_at);
          const now = new Date();
          return orderDate.getMonth() === now.getMonth() && 
                 orderDate.getFullYear() === now.getFullYear();
        });
        const monthlyVolume = thisMonthOrders.reduce((sum, o) => {
          // Estimate lbs from order value (avg $3k/lb)
          return sum + (Number(o.total_amount || 0) / 3000);
        }, 0);
        const avgOrder = orders.length > 0 
          ? totalSpent / orders.length 
          : 0;

        // Calculate reliability (on-time payments)
        const recentPayments = payments.filter(p => {
          const paymentDate = new Date(p.payment_date);
          const daysAgo = differenceInDays(new Date(), paymentDate);
          return daysAgo <= 90;
        });
        const onTimeCount = recentPayments.length; // Simplified
        const reliabilityScore = Math.min(100, 60 + (onTimeCount * 5));

        // Days overdue calculation
        const lastPaymentDate = payments.length > 0 
          ? new Date(payments[0].payment_date) 
          : null;
        const daysOverdue = lastPaymentDate && Number(client.outstanding_balance) > 0
          ? differenceInDays(new Date(), lastPaymentDate)
          : 0;

        return {
          ...client,
          total_spent: totalSpent,
          monthly_volume_lbs: monthlyVolume,
          avg_order_size: avgOrder,
          reliability_score: reliabilityScore,
          days_overdue: daysOverdue,
          order_count: orders.length,
        };
      });
    },
    enabled: !!account?.id,
  });

  const filteredClients = clients?.filter(client => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      client.business_name?.toLowerCase().includes(search) ||
      client.contact_name?.toLowerCase().includes(search) ||
      client.phone?.includes(search)
    );
  }) || [];

  // Sort clients
  const sortedClients = [...filteredClients].sort((a, b) => {
    if (sortBy === 'outstanding_credit') {
      return Number(b.outstanding_balance || 0) - Number(a.outstanding_balance || 0);
    } else if (sortBy === 'total_spent') {
      return b.total_spent - a.total_spent;
    } else if (sortBy === 'reliability') {
      return b.reliability_score - a.reliability_score;
    }
    return 0;
  });

  const getStatusBadge = (client: any) => {
    const balance = Number(client.outstanding_balance || 0);
    const daysOverdue = client.days_overdue || 0;

    if (balance === 0) {
      return <Badge className="bg-green-500">Paid in Full</Badge>;
    } else if (daysOverdue > 14) {
      return <Badge variant="destructive">{daysOverdue} days overdue</Badge>;
    } else if (daysOverdue > 7) {
      return <Badge className="bg-yellow-500">{daysOverdue} days overdue</Badge>;
    } else if (balance > 0) {
      return <Badge variant="outline">Due in {Math.max(0, 7 - daysOverdue)} days</Badge>;
    }
    return <Badge variant="outline">Active</Badge>;
  };

  const getReliabilityStars = (score: number) => {
    const stars = Math.floor(score / 20);
    return '⭐'.repeat(Math.min(5, stars)) + '☆'.repeat(Math.max(0, 5 - stars));
  };

  const getClientTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      sub_dealer: 'Sub-Dealer',
      smoke_shop: 'Small Shop',
      distributor: 'Network/Crew',
      supplier: 'Supplier',
      other: 'Other',
    };
    return types[type] || type;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">💼 Clients</h1>
          <p className="text-muted-foreground">B2B wholesale buyers and suppliers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => navigate('/admin/wholesale-clients/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="credit_approved">Credit Approved</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="top_spenders">Top Spenders</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search & Sort */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="outstanding_credit">Sort: Outstanding Credit</option>
          <option value="total_spent">Sort: Total Spent</option>
          <option value="reliability">Sort: Reliability</option>
        </select>
      </div>

      {/* Client List */}
      {isLoading ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading clients...</p>
        </Card>
      ) : sortedClients.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">No clients found</p>
          <Button onClick={() => navigate('/admin/wholesale-clients/new')}>
            Add Your First Client
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedClients.map((client) => {
            const creditUsed = Number(client.credit_limit || 0) > 0
              ? (Number(client.outstanding_balance || 0) / Number(client.credit_limit)) * 100
              : 0;

            return (
              <Card key={client.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{client.business_name}</h3>
                      {getStatusBadge(client)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {client.phone}
                      </div>
                      {client.address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {client.address.split(',')[1]?.trim() || client.address}
                        </div>
                      )}
                      <div>
                        Type: {getClientTypeLabel(client.client_type)}
                      </div>
                      <div>
                        Since: {client.created_at ? format(new Date(client.created_at), 'MMM yyyy') : 'N/A'}
                      </div>
                      <div>
                        Reliability: {getReliabilityStars(client.reliability_score || 50)}
                      </div>
                    </div>

                    {/* Credit Status */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">
                          Credit: ${Number(client.outstanding_balance || 0).toLocaleString()}
                        </span>
                        {client.credit_limit > 0 && (
                          <span className="text-sm text-muted-foreground">
                            Limit: ${Number(client.credit_limit).toLocaleString()} 
                            ({creditUsed.toFixed(0)}% used)
                          </span>
                        )}
                      </div>
                      {client.credit_limit > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              creditUsed > 90 ? 'bg-red-500' :
                              creditUsed > 75 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, creditUsed)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <div className="text-muted-foreground">This Month</div>
                        <div className="font-semibold">
                          {client.monthly_volume_lbs.toFixed(1)} lbs
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ${(client.monthly_volume_lbs * 3000).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Order</div>
                        <div className="font-semibold">
                          ${Math.round(client.avg_order_size).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ~{Math.round(client.avg_order_size / 3000)} lbs
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Orders</div>
                        <div className="font-semibold">
                          {client.order_count}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {client.order_count > 0 
                            ? `~${Math.round(7 / (client.order_count || 1))}x/week`
                            : 'New client'
                          }
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total Spent</div>
                        <div className="font-semibold">
                          ${client.total_spent.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    💬 Message
                  </Button>
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-2" />
                    📞 Call
                  </Button>
                  {Number(client.outstanding_balance) > 0 && (
                    <Button 
                      variant={client.days_overdue > 14 ? 'destructive' : 'default'}
                      size="sm"
                      onClick={() => navigate(`/admin/financial-center?client=${client.id}`)}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      💰 Collect
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/admin/wholesale-clients/new-order?client=${client.id}`)}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    📦 New Order
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/admin/wholesale-clients/${client.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

