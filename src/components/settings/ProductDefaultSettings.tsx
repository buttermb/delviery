import { Card } from '@/components/ui/card';
import { Package } from 'lucide-react';

export function ProductDefaultSettings() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Package className="h-5 w-5" />
        Product Default Settings
      </h3>
      <p className="text-muted-foreground">
        Configure default values for new products including tax rates, units, and categories.
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        Coming soon: Set defaults for new products to speed up product creation.
      </div>
    </Card>
  );
}
