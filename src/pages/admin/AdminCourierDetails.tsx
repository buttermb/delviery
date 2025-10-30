import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatStatus } from '@/utils/stringHelpers';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import CourierPinManagement from '@/components/admin/CourierPinManagement';

export default function AdminCourierDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courier, setCourier] = useState<any>(null);
  const [earnings, setEarnings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCommissionDialog, setShowCommissionDialog] = useState(false);
  const [newCommissionRate, setNewCommissionRate] = useState('');
  const [commissionReason, setCommissionReason] = useState('');

  useEffect(() => {
    if (id) {
      fetchCourierData();
    }
  }, [id]);

  const fetchCourierData = async () => {
    setLoading(true);
    try {
      const [courierRes, earningsRes, ordersRes] = await Promise.all([
        supabase.from('couriers').select('*').eq('id', id).maybeSingle(),
        supabase.from('courier_earnings').select('*').eq('courier_id', id).order('created_at', { ascending: false }),
        supabase.from('orders').select('*, merchants(*), addresses(*)').eq('courier_id', id).order('created_at', { ascending: false })
      ]);

      if (courierRes.error) throw courierRes.error;
      if (!courierRes.data) throw new Error("Courier not found");
      
      setCourier(courierRes.data);
      setEarnings(earningsRes.data || []);
      setOrders(ordersRes.data || []);
      setNewCommissionRate(courierRes.data.commission_rate?.toString() || '30');
    } catch (error) {
      console.error('Error fetching courier:', error);
      toast({
        title: "Error",
        description: "Failed to load courier details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCommissionChange = async () => {
    if (!newCommissionRate || parseFloat(newCommissionRate) < 0 || parseFloat(newCommissionRate) > 100) {
      toast({
        title: "Invalid rate",
        description: "Commission rate must be between 0 and 100",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('couriers')
        .update({ commission_rate: parseFloat(newCommissionRate) })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Commission rate updated successfully"
      });

      setShowCommissionDialog(false);
      fetchCourierData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update commission rate",
        variant: "destructive"
      });
    }
  };

  const handleProcessPayout = async () => {
    const pendingEarnings = earnings.filter(e => e.status === 'pending');
    if (pendingEarnings.length === 0) {
      toast({
        title: "No pending earnings",
        description: "This courier has no pending earnings to process"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('courier_earnings')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('courier_id', id)
        .eq('status', 'pending');

      if (error) throw error;

      const totalPaid = pendingEarnings.reduce((sum, e) => sum + parseFloat(e.total_earned), 0);

      toast({
        title: "Payout Processed",
        description: `Successfully processed $${totalPaid.toFixed(2)} payout`
      });

      fetchCourierData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process payout",
        variant: "destructive"
      });
    }
  };

  const toggleCourierStatus = async () => {
    try {
      const { error } = await supabase
        .from('couriers')
        .update({ is_active: !courier.is_active })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Courier ${!courier.is_active ? 'activated' : 'deactivated'}`
      });

      fetchCourierData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update courier status",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!courier) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Courier not found</p>
        <Button onClick={() => navigate('/admin/couriers')} className="mt-4">
          Back to Couriers
        </Button>
      </div>
    );
  }

  const totalEarnings = earnings.reduce((sum, e) => sum + parseFloat(e.total_earned), 0);
  const pendingEarnings = earnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + parseFloat(e.total_earned), 0);
  const totalDeliveries = earnings.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/couriers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{courier.full_name}</h1>
          <p className="text-muted-foreground">{courier.email}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge variant={courier.is_online ? "default" : "secondary"}>
            {courier.is_online ? '🟢 Online' : '⚪ Offline'}
          </Badge>
          <Badge variant={courier.is_active ? "default" : "destructive"}>
            {courier.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Commission Rate</p>
          <p className="text-3xl font-bold">{courier.commission_rate}%</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Deliveries</p>
          <p className="text-3xl font-bold">{totalDeliveries}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Total Earnings</p>
          <p className="text-3xl font-bold">${totalEarnings.toFixed(2)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Pending Earnings</p>
          <p className="text-3xl font-bold text-orange-600">${pendingEarnings.toFixed(2)}</p>
        </Card>
      </div>

      {/* Courier PIN Status */}
      {courier.pin_set_at && (
        <Card className="p-4 bg-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold mb-1">Courier Security PIN</h4>
              <p className="text-xs text-muted-foreground">
                Set {new Date(courier.pin_set_at).toLocaleDateString()} at{' '}
                {new Date(courier.pin_set_at).toLocaleTimeString()}
              </p>
              {courier.pin_last_verified_at && (
                <p className="text-xs text-muted-foreground">
                  Last used: {new Date(courier.pin_last_verified_at).toLocaleString()}
                </p>
              )}
            </div>
            <div>
              {(() => {
                const daysSinceSet = courier.pin_set_at 
                  ? (Date.now() - new Date(courier.pin_set_at).getTime()) / (1000 * 60 * 60 * 24)
                  : 0;
                const daysRemaining = Math.max(0, 5 - Math.floor(daysSinceSet));
                
                return (
                  <div className="text-right">
                    <div className={`text-lg font-bold ${daysRemaining <= 1 ? 'text-destructive' : daysRemaining <= 2 ? 'text-orange-600' : 'text-green-600'}`}>
                      {daysRemaining} days
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {daysRemaining === 0 ? 'Expired' : 'remaining'}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={() => setShowCommissionDialog(true)}>
          Change Commission
        </Button>
        <Button onClick={handleProcessPayout} disabled={pendingEarnings === 0}>
          Process Payout (${pendingEarnings.toFixed(2)})
        </Button>
        <Button variant={courier.is_active ? "destructive" : "default"} onClick={toggleCourierStatus}>
          {courier.is_active ? 'Deactivate Courier' : 'Activate Courier'}
        </Button>
      </div>

      {/* PIN Management */}
      <CourierPinManagement
        courierId={courier.id}
        currentPin={courier.admin_pin}
        courierName={courier.full_name}
      />

      {/* Tabs */}
      <Tabs defaultValue="earnings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="earnings">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No earnings yet
                    </TableCell>
                  </TableRow>
                ) : (
                  earnings.map((earning) => (
                    <TableRow key={earning.id}>
                      <TableCell>{new Date(earning.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono text-sm">{earning.order_id?.substring(0, 8)}</TableCell>
                      <TableCell>${earning.commission_amount}</TableCell>
                      <TableCell>${earning.tip_amount || 0}</TableCell>
                      <TableCell className="font-semibold">${earning.total_earned}</TableCell>
                      <TableCell>
                        <Badge variant={earning.status === 'paid' ? 'default' : 'secondary'}>
                          {earning.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Delivery Address</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No orders yet
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono">{order.order_number}</TableCell>
                      <TableCell>{order.merchants?.business_name}</TableCell>
                      <TableCell className="text-sm">{order.addresses?.street}</TableCell>
                      <TableCell className="font-semibold">${order.total_amount}</TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                          {formatStatus(order?.status || 'pending')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Commission Change Dialog */}
      <Dialog open={showCommissionDialog} onOpenChange={setShowCommissionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Commission Rate</DialogTitle>
            <DialogDescription>
              Update the commission rate for {courier.full_name}. This will apply to all future deliveries.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Current Rate: {courier.commission_rate}%</label>
              <Input
                type="number"
                placeholder="New rate"
                value={newCommissionRate}
                onChange={(e) => setNewCommissionRate(e.target.value)}
                min="0"
                max="100"
                step="0.01"
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                placeholder="Why are you changing the commission rate?"
                value={commissionReason}
                onChange={(e) => setCommissionReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommissionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCommissionChange}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
