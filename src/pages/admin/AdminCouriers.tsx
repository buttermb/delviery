import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, UserPlus, Users, Activity, DollarSign, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { AddCourierDialog } from '@/components/admin/AddCourierDialog';

interface Courier {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  is_active: boolean;
  is_online: boolean;
  commission_rate: number | null;
  created_at: string;
  today_earnings?: number;
  age_verified?: boolean;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
}

export default function AdminCouriers() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    fetchCouriers();
    
    const setupChannel = async () => {
      channel = supabase
        .channel('couriers-changes', {
          config: {
            broadcast: { self: false },
            presence: { key: '' }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'couriers' }, () => {
          fetchCouriers();
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to couriers channel');
          }
        });
    };

    setupChannel();

    return () => {
      if (channel) {
        supabase.removeChannel(channel).then(() => {
          channel = null;
        });
      }
    };
  }, []);

  const fetchCouriers = async () => {
    try {
      // Use optimized RPC function for instant fetch with today's earnings
      const { data, error } = await supabase.rpc('get_couriers_with_daily_earnings');

      if (error) throw error;

      setCouriers((data as unknown as Courier[]) || []);
    } catch (error) {
      console.error('Error fetching couriers:', error);
      toast({
        title: "Error",
        description: "Failed to load couriers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCourierStatus = async (courierId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('couriers')
        .update({ is_active: !currentStatus })
        .eq('id', courierId);

      if (error) throw error;

      toast({
        title: "✓ Status updated",
        description: `Courier ${!currentStatus ? 'activated' : 'deactivated'}`
      });

      await fetchCouriers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update courier status",
        variant: "destructive"
      });
    }
  };

  const filteredCouriers = couriers.filter(courier =>
    (courier.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (courier.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (courier.phone || '').includes(search)
  );

  const stats = {
    total: couriers.length,
    online: couriers.filter(c => c.is_online).length,
    active: couriers.filter(c => c.is_active).length,
    todayEarnings: couriers.reduce((sum, c) => sum + (c.today_earnings || 0), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Courier Management</h1>
        <p className="text-muted-foreground">Manage delivery drivers and track performance</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Couriers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Online Now
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.online}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Today's Earnings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.todayEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search couriers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <AddCourierDialog onSuccess={fetchCouriers} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Today's Earnings</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCouriers.map((courier) => (
                <TableRow key={courier.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{courier.full_name}</p>
                      <p className="text-sm text-muted-foreground">{courier.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{courier.phone}</p>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium capitalize">{courier.vehicle_type}</p>
                      <p className="text-sm text-muted-foreground">{courier.vehicle_plate}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={courier.is_online ? "default" : "secondary"}>
                      {courier.is_online ? 'Online' : 'Offline'}
                    </Badge>
                  </TableCell>
                  <TableCell>{courier.commission_rate}%</TableCell>
                  <TableCell className="font-medium text-green-600">
                    ${(courier.today_earnings || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={courier.is_active}
                      onCheckedChange={() => toggleCourierStatus(courier.id, courier.is_active)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/admin/couriers/${courier.id}`)}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredCouriers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No couriers found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
