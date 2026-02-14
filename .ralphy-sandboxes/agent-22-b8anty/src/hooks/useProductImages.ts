import { logger } from '@/lib/logger';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { queryKeys } from '@/lib/queryKeys';

export const useGenerateProductImage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      productName,
      category,
      strainType
    }: {
      productId: string;
      productName: string;
      category: string;
      strainType?: string;
    }) => {
      // Call edge function to generate image
      const { data, error } = await supabase.functions.invoke('generate-product-images', {
        body: { productName, category, strainType }
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to generate product image';
        throw new Error(errorMessage);
      }

      if (!data?.imageUrl) throw new Error('No image URL returned');

      // Convert base64 to blob
      const base64Data = data.imageUrl.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      // Upload to storage
      const fileName = `${productId}-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      // Update product with image URL
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: publicUrl })
        .eq('id', productId);

      if (updateError) throw updateError;

      return { publicUrl };
    },
    onMutate: async ({ productId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });
      const previousProducts = queryClient.getQueryData(['products']);
      return { previousProducts, productId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
      const message = error instanceof Error ? error.message : 'Failed to generate image';
      logger.error('Image generation failed', error, { component: 'useGenerateProductImage' });
      toast.error('Image generation failed', { description: message });
    },
    onSuccess: () => {
      toast.success('Product image generated successfully');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: ['products-for-wholesale'] });
    },
  });
};

export const useBulkGenerateImages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (products: Array<{
      id: string;
      name: string;
      category: string;
      strain_type?: string;
    }>) => {
      logger.debug('useBulkGenerateImages called with:', products.length, 'products');
      const results = [];

      for (let i = 0; i < products.length; i++) {
        const product = products[i];

        try {
          logger.debug(`Generating image ${i + 1}/${products.length} for:`, product.name);

          // Call edge function to generate image
          const { data, error } = await supabase.functions.invoke('generate-product-images', {
            body: {
              productName: product.name,
              category: product.category,
              strainType: product.strain_type
            }
          });

          logger.debug('Edge function response:', { data, error });

          if (error) throw error;

          // Check for error in response body (some edge functions return 200 with error)
          if (data && typeof data === 'object' && 'error' in data && data.error) {
            const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to generate product image';
            throw new Error(errorMessage);
          }
          if (!data?.imageUrl) throw new Error('No image URL returned');

          // Convert base64 to blob
          const base64Data = data.imageUrl.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/png' });

          // Upload to storage
          const fileName = `${product.id}-${Date.now()}.png`;
          logger.debug('Uploading to storage:', fileName);

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, blob, {
              contentType: 'image/png',
              upsert: true
            });

          if (uploadError) {
            logger.error('Upload error:', uploadError);
            throw uploadError;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

          logger.debug('Public URL:', publicUrl);

          // Update product with image URL
          const { error: updateError } = await supabase
            .from('products')
            .update({ image_url: publicUrl })
            .eq('id', product.id);

          if (updateError) {
            logger.error('Database update error:', updateError);
            throw updateError;
          }

          logger.debug(`Successfully generated image for ${product.name}`);
          results.push({ productId: product.id, success: true, url: publicUrl });

          // Add delay between requests to avoid rate limits
          if (i < products.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          logger.error(`Error generating image for ${product.name}:`, error);
          results.push({ productId: product.id, success: false, error });
        }
      }

      logger.debug('Bulk generation complete. Results:', results);
      return results;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });
      const previousProducts = queryClient.getQueryData(['products']);
      return { previousProducts };
    },
    onError: (error, _variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
      const message = error instanceof Error ? error.message : 'Failed to generate images';
      logger.error('Bulk image generation failed', error, { component: 'useBulkGenerateImages' });
      toast.error('Bulk image generation failed', { description: message });
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      toast.success(`Generated ${successCount}/${results.length} images successfully`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: ['products-for-wholesale'] });
    },
  });
};
