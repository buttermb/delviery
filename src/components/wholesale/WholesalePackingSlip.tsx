import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Printer, Package } from 'lucide-react';

interface PackingSlipItem {
  name: string;
  sku: string;
  quantity: number;
}

interface WholesalePackingSlipProps {
  orderId: string;
  clientName: string;
  items: PackingSlipItem[];
  orderDate: string;
}

export function WholesalePackingSlip({
  orderId,
  clientName,
  items,
  orderDate,
}: WholesalePackingSlipProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Card className="p-6 print:p-8">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Packing Slip
        </h3>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      <div className="space-y-6 print:text-black">
        <div className="border-b pb-4">
          <div className="text-sm text-muted-foreground">Order ID</div>
          <div className="font-mono font-bold text-xl">{orderId}</div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground">Ship To</div>
          <div className="font-semibold text-lg">{clientName}</div>
          <div className="text-sm text-muted-foreground mt-1">
            Order Date: {new Date(orderDate).toLocaleDateString()}
          </div>
        </div>

        <div>
          <div className="font-semibold mb-3">Items</div>
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2">SKU</th>
                <th className="text-left py-2">Product</th>
                <th className="text-right py-2">Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b last:border-b-0">
                  <td className="py-2 font-mono text-sm">{item.sku}</td>
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-right font-bold">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-sm text-muted-foreground pt-4 border-t">
          Total Items: {items.reduce((sum, item) => sum + item.quantity, 0)}
        </div>
      </div>
    </Card>
  );
}
