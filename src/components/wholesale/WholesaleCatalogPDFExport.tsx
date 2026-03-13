import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export function WholesaleCatalogPDFExport() {
  const { tenant } = useTenantAdminAuth();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!tenant?.id) {
      toast.error('No tenant context');
      return;
    }

    setIsExporting(true);
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('name, sku, category, wholesale_price, description, available_quantity')
        .eq('tenant_id', tenant.id)
        .eq('archived', false)
        .order('category', { ascending: true });

      if (error) throw error;

      const csvLines = [
        'Wholesale Catalog',
        `Generated: ${new Date().toLocaleString()}`,
        '',
        'SKU,Product Name,Category,Price,Stock,Description',
        ...products.map((p) =>
          `"${p.sku}","${p.name}","${p.category}","${p.wholesale_price || '0.00'}","${p.available_quantity || 0}","${p.description || ''}"`
        ),
      ];

      const csv = csvLines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wholesale-catalog-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Catalog exported successfully');
      logger.info('Exported wholesale catalog');
    } catch (error) {
      logger.error('Failed to export catalog', error);
      toast.error('Failed to export catalog');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">Wholesale Catalog Export</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Export full product catalog with pricing for wholesale clients
          </p>
        </div>
        <Button onClick={handleExport} disabled={isExporting} variant="outline">
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-2" />
              Export CSV
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
