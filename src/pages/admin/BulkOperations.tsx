import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Package, Upload, Download, Zap } from 'lucide-react';

export default function BulkOperations() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const [operation, setOperation] = useState<string>('');
  const [target, setTarget] = useState<string>('');

  const { data: products } = useQuery({
    queryKey: ['products', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase.from('products').select('*').limit(100);
        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const handleBulkOperation = async () => {
    if (!operation || !target) {
      toast({
        title: 'Missing Information',
        description: 'Please select both operation and target',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Operation Started',
      description: `Bulk ${operation} on ${target} has been initiated.`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Operations</h1>
        <p className="text-muted-foreground">Perform bulk actions on multiple items</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bulk Update</CardTitle>
            <CardDescription>Update multiple items at once</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Operation</label>
              <Select value={operation} onValueChange={setOperation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select operation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update-price">Update Prices</SelectItem>
                  <SelectItem value="update-status">Update Status</SelectItem>
                  <SelectItem value="update-category">Update Category</SelectItem>
                  <SelectItem value="delete">Delete Items</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target</label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleBulkOperation} className="w-full">
              <Zap className="h-4 w-4 mr-2" />
              Execute Operation
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import/Export</CardTitle>
            <CardDescription>Bulk import or export data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            <Button variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Items</CardTitle>
          <CardDescription>Items available for bulk operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <span className="font-medium">Products</span>
              </div>
              <Badge>{products?.length || 0} items</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

