/**
 * Setup Wizard Step 2: Add First Products
 * Supports manual product add and bulk CSV import
 */

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Package, Upload, Plus, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { Database } from '@/integrations/supabase/types';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

type ProductInsert = Database['public']['Tables']['products']['Insert'];

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required').max(200, 'Product name must be 200 characters or less'),
  sku: z.string().optional(),
  price: z.string().min(1, 'Price is required').refine((val) => !isNaN(Number(val)) && Number(val) >= 0, 'Price must be a valid number'),
  category: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface AddProductsStepProps {
  onComplete: () => void;
}

export function AddProductsStep({ onComplete }: AddProductsStepProps) {
  const { tenant } = useTenantAdminAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addedProducts, setAddedProducts] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      sku: '',
      price: '',
      category: '',
    },
  });

  const onSubmitProduct = async (data: ProductFormData) => {
    if (!tenant?.id) return;
    setIsSubmitting(true);

    try {
      // Check for duplicate product name within tenant
      const { data: existingProduct, error: dupError } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('name', data.name.trim())
        .maybeSingle();

      if (dupError) {
        logger.error('Error checking product name uniqueness', dupError, { component: 'AddProductsStep' });
      }

      if (existingProduct) {
        toast.error('A product with this name already exists');
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from('products')
        .insert({
          tenant_id: tenant.id,
          name: data.name,
          sku: data.sku || null,
          price: Number(data.price),
          category: data.category || 'Flower',
          thca_percentage: 0,
          in_stock: true,
        });

      if (error) throw error;

      setAddedProducts((prev) => [...prev, data.name]);
      form.reset();
      toast.success(`"${data.name}" added!`);
    } catch (error) {
      logger.error('Failed to add product', error instanceof Error ? error : new Error(String(error)), { component: 'AddProductsStep' });
      toast.error('Failed to add product. Please try again.', { description: humanizeError(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('CSV file must be under 10MB');
      return;
    }

    setCsvFile(file);
    setImportResult(null);
  };

  const handleCsvImport = async () => {
    if (!csvFile || !tenant?.id) return;
    setIsImporting(true);

    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        toast.error('CSV must have a header row and at least one product');
        return;
      }

      // Parse header
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const nameIdx = headers.findIndex((h) => h === 'name' || h === 'product_name' || h === 'product');
      const priceIdx = headers.findIndex((h) => h === 'price' || h === 'unit_price');
      const skuIdx = headers.findIndex((h) => h === 'sku' || h === 'product_sku');
      const categoryIdx = headers.findIndex((h) => h === 'category' || h === 'type');

      if (nameIdx === -1) {
        toast.error('CSV must have a "name" column');
        return;
      }

      let success = 0;
      let failed = 0;
      const products: ProductInsert[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const name = cols[nameIdx];
        if (!name) {
          failed++;
          continue;
        }

        products.push({
          tenant_id: tenant.id,
          name,
          price: priceIdx !== -1 && cols[priceIdx] ? Number(cols[priceIdx]) || 0 : 0,
          sku: skuIdx !== -1 ? cols[skuIdx] || null : null,
          category: (categoryIdx !== -1 && cols[categoryIdx]) ? cols[categoryIdx] : 'Flower',
          thca_percentage: 0,
          in_stock: true,
        });
      }

      if (products.length > 0) {
        // Insert in batches of 50
        for (let i = 0; i < products.length; i += 50) {
          const batch = products.slice(i, i + 50);
          const { error } = await supabase.from('products').insert(batch);

          if (error) {
            logger.error('Batch insert failed', error, { component: 'AddProductsStep', batchIndex: i });
            failed += batch.length;
          } else {
            success += batch.length;
          }
        }
      }

      setImportResult({ success, failed });

      if (success > 0) {
        toast.success(`Imported ${success} products!`);
      }
      if (failed > 0) {
        toast.error(`${failed} rows failed to import`);
      }
    } catch (error) {
      logger.error('CSV import failed', error instanceof Error ? error : new Error(String(error)), { component: 'AddProductsStep' });
      toast.error('Import failed. Check your CSV format.', { description: humanizeError(error) });
    } finally {
      setIsImporting(false);
    }
  };

  const hasProducts = addedProducts.length > 0 || (importResult?.success ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl">
          <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Add Your First Products</h3>
          <p className="text-sm text-muted-foreground">Add products manually or import via CSV</p>
        </div>
      </div>

      <Tabs defaultValue="manual" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">
            <Plus className="h-4 w-4 mr-2" />
            Manual
          </TabsTrigger>
          <TabsTrigger value="csv">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            CSV Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitProduct)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Blue Dream 3.5g" maxLength={200} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Flower, Edibles, Concentrates" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </>
                )}
              </Button>
            </form>
          </Form>

          {addedProducts.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                Added {addedProducts.length} product{addedProducts.length !== 1 ? 's' : ''}:
              </p>
              <ul className="space-y-1">
                {addedProducts.map((name, i) => (
                  <li key={i} className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="csv" className="mt-4 space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
            <p className="font-medium">CSV Format</p>
            <p className="text-muted-foreground">
              Your CSV should include columns: <code className="bg-muted px-1 rounded">name</code>,{' '}
              <code className="bg-muted px-1 rounded">price</code>,{' '}
              <code className="bg-muted px-1 rounded">sku</code> (optional),{' '}
              <code className="bg-muted px-1 rounded">category</code> (optional)
            </p>
          </div>

          <div
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              {csvFile ? csvFile.name : 'Click to select CSV file'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvSelect}
            />
          </div>

          {csvFile && (
            <Button
              onClick={handleCsvImport}
              disabled={isImporting}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Products
                </>
              )}
            </Button>
          )}

          {importResult && (
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <p className="font-medium mb-1">Import Results</p>
              <p className="text-green-600">{importResult.success} products imported</p>
              {importResult.failed > 0 && (
                <p className="text-red-600">{importResult.failed} rows failed</p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {hasProducts && (
        <Button onClick={onComplete} variant="default" className="w-full">
          Continue to Next Step
        </Button>
      )}
    </div>
  );
}
