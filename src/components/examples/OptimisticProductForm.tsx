/**
 * Example: Product Form with Optimistic Updates
 * Demonstrates complete optimistic UI implementation
 */

import { useState } from 'react';
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';
import { OptimisticFormWrapper } from '@/components/shared/OptimisticFormWrapper';
import { OptimisticButton } from '@/components/shared/OptimisticButton';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// Validation schema
const productSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  price: z.number().positive('Price must be positive').max(10000),
  category: z.enum(['flower', 'edibles', 'vapes', 'concentrates']),
  stock_quantity: z.number().int().min(0, 'Stock cannot be negative'),
});

type ProductFormData = z.infer<typeof productSchema>;

interface Product extends ProductFormData {
  id: string;
  created_at: string;
}

export function OptimisticProductForm() {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    price: 0,
    category: 'flower',
    stock_quantity: 0,
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { execute, isOptimistic, isLoading, error, reset } = useOptimisticUpdate<Product>({
    successMessage: '✓ Product created successfully!',
    errorMessage: 'Failed to create product',
    onSuccess: (product) => {
      logger.info('Product created with optimistic update', { productId: product.id });
      // Reset form after success
      setTimeout(() => {
        setFormData({
          name: '',
          price: 0,
          category: 'flower',
          stock_quantity: 0,
        });
        reset();
      }, 1500); // Keep success state visible for 1.5s
    },
    onError: (err) => {
      logger.error('Failed to create product', err);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationErrors({});

    // Validate before optimistic update
    const validation = productSchema.safeParse(formData);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setValidationErrors(errors);
      return;
    }

    // Execute with optimistic update
    await execute(
      formData,
      // Optimistic data (shown immediately)
      {
        ...formData,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
      },
      // Actual operation (runs in background)
      async (params) => {
        // Simulate network delay (remove in production)
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data, error } = await supabase
          .from('products')
          .insert([{
            name: params.name,
            price: params.price,
            category: params.category,
            stock_quantity: params.stock_quantity,
            thca_percentage: 0, // Required field - set to 0 for demo
          }])
          .select()
          .single();

        if (error) throw error;
        return data as Product;
      }
    );
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create Product (Optimistic UI Demo)</CardTitle>
      </CardHeader>
      <CardContent>
        <OptimisticFormWrapper
          onSubmit={handleSubmit}
          isOptimistic={isOptimistic}
          isLoading={isLoading}
          hasError={!!error}
          showNetworkStatus={true}
          className="space-y-6"
        >
          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isLoading}
              placeholder="Enter product name"
              className={validationErrors.name ? 'border-red-500' : ''}
            />
            {validationErrors.name && (
              <p className="text-sm text-red-500">{validationErrors.name}</p>
            )}
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Price ($)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price || ''}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              disabled={isLoading}
              placeholder="0.00"
              className={validationErrors.price ? 'border-red-500' : ''}
            />
            {validationErrors.price && (
              <p className="text-sm text-red-500">{validationErrors.price}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value as any })}
              disabled={isLoading}
            >
              <SelectTrigger className={validationErrors.category ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flower">Flower</SelectItem>
                <SelectItem value="edibles">Edibles</SelectItem>
                <SelectItem value="vapes">Vapes</SelectItem>
                <SelectItem value="concentrates">Concentrates</SelectItem>
              </SelectContent>
            </Select>
            {validationErrors.category && (
              <p className="text-sm text-red-500">{validationErrors.category}</p>
            )}
          </div>

          {/* Stock Quantity */}
          <div className="space-y-2">
            <Label htmlFor="stock">Stock Quantity</Label>
            <Input
              id="stock"
              type="number"
              value={formData.stock_quantity || ''}
              onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
              disabled={isLoading}
              placeholder="0"
              className={validationErrors.stock_quantity ? 'border-red-500' : ''}
            />
            {validationErrors.stock_quantity && (
              <p className="text-sm text-red-500">{validationErrors.stock_quantity}</p>
            )}
          </div>

          {/* Submit Button */}
          <OptimisticButton
            type="submit"
            isOptimistic={isOptimistic}
            isLoading={isLoading}
            hasError={!!error}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Creating Product...' : isOptimistic ? 'Product Created!' : 'Create Product'}
          </OptimisticButton>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
            <p className="font-medium mb-2">🎯 Optimistic UI Demo</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Submit shows success immediately</li>
              <li>• Actual save happens in background</li>
              <li>• Automatically rolls back on failure</li>
              <li>• Works offline - queues for sync</li>
              <li>• Try disconnecting wifi to test!</li>
            </ul>
          </div>
        </OptimisticFormWrapper>
      </CardContent>
    </Card>
  );
}
