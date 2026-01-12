import { InventoryAlertsDashboard } from '@/components/admin/inventory/InventoryAlertsDashboard';
import { QuickReceiving } from '@/components/admin/inventory/QuickReceiving';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, PackageCheck, TrendingDown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function InventoryMonitoringPage() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time stock alerts and quick receiving
          </p>
        </div>
      </div>

      <Tabs defaultValue="alerts" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="receiving" className="flex items-center gap-2">
            <PackageCheck className="h-4 w-4" />
            Quick Receiving
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-6">
          <InventoryAlertsDashboard />
        </TabsContent>

        <TabsContent value="receiving">
          <QuickReceiving />
        </TabsContent>
      </Tabs>
    </div>
  );
}
