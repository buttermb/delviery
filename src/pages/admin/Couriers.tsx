import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Users, TrendingUp, DollarSign, Star, Search, Eye } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { CourierLoginInfo } from '@/components/admin/CourierLoginInfo';

interface Courier {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  is_online: boolean;
  is_active: boolean;
  rating: number;
  total_deliveries: number;
  commission_rate: number;
}

export default function Couriers() {
  const navigate = useNavigate();
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCouriers();
  }, []);

  const loadCouriers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('couriers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCouriers(data || []);
    } catch (error: any) {
      console.error('Error loading couriers:', error);
      toast.error('Failed to load couriers');
    } finally {
      setLoading(false);
    }
  };

  const filteredCouriers = couriers.filter(courier =>
    courier.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    courier.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    courier.phone?.includes(searchQuery)
  );

  const stats = [
    { label: 'Total Couriers', value: couriers.length, icon: Users, color: 'text-blue-500' },
    { label: 'Online Now', value: couriers.filter(c => c.is_online).length, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Active', value: couriers.filter(c => c.is_active).length, icon: Star, color: 'text-yellow-500' },
    { label: 'Avg Rating', value: (couriers.reduce((acc, c) => acc + (c.rating || 0), 0) / couriers.length || 0).toFixed(1), icon: Star, color: 'text-orange-500' },
  ];

  return (
    <>
      <SEOHead 
        title="Couriers Management | Admin"
        description="Manage delivery couriers"
      />
      
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Couriers Management</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${stat.color}`} />
                </div>
              </Card>
            );
          })}
        </div>

        <CourierLoginInfo />

        <Card className="p-4">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Deliveries</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredCouriers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">No couriers found</TableCell>
                </TableRow>
              ) : (
                filteredCouriers.map((courier) => (
                  <TableRow key={courier.id}>
                    <TableCell className="font-medium">{courier.full_name}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{courier.email}</p>
                        <p className="text-sm text-muted-foreground">{courier.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{courier.vehicle_type}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {courier.is_online && <Badge variant="default">Online</Badge>}
                        {!courier.is_active && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                        {courier.rating?.toFixed(1) || '5.0'}
                      </div>
                    </TableCell>
                    <TableCell>{courier.total_deliveries || 0}</TableCell>
                    <TableCell>{courier.commission_rate}%</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/admin/couriers/${courier.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
