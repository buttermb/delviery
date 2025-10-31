import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      const { data: uploadData, error: uploadError } = await supabase.storage
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
        .from('wholesale_inventory')
        .update({ image_url: publicUrl })
        .eq('id', productId);

      if (updateError) throw updateError;

      return { publicUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-inventory'] });
      toast.success('Product image generated successfully');
    },
    onError: (error) => {
      console.error('Error generating image:', error);
      toast.error('Failed to generate image');
    }
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
      console.log('useBulkGenerateImages called with:', products.length, 'products');
      const results = [];
      
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        try {
          console.log(`Generating image ${i + 1}/${products.length} for:`, product.name);
          
          // Call edge function to generate image
          const { data, error } = await supabase.functions.invoke('generate-product-images', {
            body: { 
              productName: product.name, 
              category: product.category, 
              strainType: product.strain_type 
            }
          });

          console.log('Edge function response:', { data, error });

          if (error) throw error;
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
          console.log('Uploading to storage:', fileName);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, blob, {
              contentType: 'image/png',
              upsert: true
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

          console.log('Public URL:', publicUrl);

          // Update product with image URL
          const { error: updateError } = await supabase
            .from('wholesale_inventory')
            .update({ image_url: publicUrl })
            .eq('id', product.id);

          if (updateError) {
            console.error('Database update error:', updateError);
            throw updateError;
          }

          console.log(`Successfully generated image for ${product.name}`);
          results.push({ productId: product.id, success: true, url: publicUrl });
          
          // Add delay between requests to avoid rate limits
          if (i < products.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Error generating image for ${product.name}:`, error);
          results.push({ productId: product.id, success: false, error });
        }
      }

      console.log('Bulk generation complete. Results:', results);
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-inventory'] });
      const successCount = results.filter(r => r.success).length;
      toast.success(`Generated ${successCount}/${results.length} images successfully`);
    },
    onError: (error) => {
      console.error('Error in bulk generation:', error);
      toast.error('Failed to generate images');
    }
  });
};
