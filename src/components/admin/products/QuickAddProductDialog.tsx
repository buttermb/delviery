import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Plus, Upload, X, Zap } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { useProductMutations } from "@/hooks/useProductMutations";
import { sanitizeFormInput } from "@/lib/utils/sanitize";
import { humanizeError } from "@/lib/humanizeError";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CurrencyInput, IntegerInput } from "@/components/ui/currency-input";
import { Progress } from "@/components/ui/progress";

const quickAddSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  category: z.string().min(1, "Category is required"),
  wholesale_price: z.string().min(1, "Price is required").refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0;
    },
    { message: "Price must be a valid positive number" }
  ),
  available_quantity: z.string().refine(
    (val) => {
      if (!val) return true;
      const num = parseInt(val, 10);
      return !isNaN(num) && num >= 0 && Number.isInteger(num);
    },
    { message: "Stock must be a whole number >= 0" }
  ),
});

type QuickAddFormData = z.infer<typeof quickAddSchema>;

interface QuickAddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  storeId?: string;
}

const MAX_FILE_SIZE_MB = 2;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function QuickAddProductDialog({
  open,
  onOpenChange,
  onSuccess,
  storeId,
}: QuickAddProductDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const { invalidateProductCaches } = useProductMutations();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [addAnother, setAddAnother] = useState(false);

  const form = useForm<QuickAddFormData>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      name: "",
      category: "flower",
      wholesale_price: "",
      available_quantity: "",
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      cleanupImage();
      setAddAnother(false);
    }
  }, [open, form]);

  const cleanupImage = useCallback(() => {
    if (imagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    setUploadProgress(0);
  }, [imagePreview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file type. Please select an image.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(
        `File too large (max ${MAX_FILE_SIZE_MB}MB). Selected: ${(file.size / (1024 * 1024)).toFixed(1)}MB`
      );
      return;
    }

    cleanupImage();
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    cleanupImage();
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploadProgress(20);
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `product-images/${fileName}`;

      setUploadProgress(50);
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setUploadProgress(80);
      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(filePath);

      setUploadProgress(100);
      return publicUrl;
    } catch (error: unknown) {
      logger.error("Failed to upload product image", error instanceof Error ? error : new Error(String(error)));
      toast.error("Image upload failed. Product will be created without an image.");
      return null;
    }
  };

  const onSubmit = async (data: QuickAddFormData) => {
    if (!tenant?.id) {
      toast.error("Tenant not found. Please refresh.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload image if present
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const productData = {
        tenant_id: tenant.id,
        name: sanitizeFormInput(data.name, 200),
        category: data.category,
        wholesale_price: parseFloat(data.wholesale_price),
        price: parseFloat(data.wholesale_price),
        available_quantity: data.available_quantity
          ? parseInt(data.available_quantity, 10)
          : 0,
        image_url: imageUrl,
        low_stock_alert: 10,
      };

      const { data: newProduct, error } = await supabase
        .from("products")
        .insert(productData)
        .select()
        .maybeSingle();

      if (error) throw error;

      // Sync to marketplace if store exists
      if (storeId && newProduct) {
        const { error: syncError } = await (
          supabase.rpc as (
            fn: string,
            params: Record<string, string>
          ) => ReturnType<typeof supabase.rpc>
        )("sync_product_to_marketplace", {
          p_product_id: newProduct.id,
          p_store_id: storeId,
        });
        if (syncError) {
          logger.warn("Product sync to marketplace failed", {
            error: syncError,
            productId: newProduct.id,
          });
        }
      }

      // Invalidate caches
      invalidateProductCaches({
        tenantId: tenant.id,
        storeId: storeId || undefined,
        productId: newProduct?.id,
        category: data.category,
      });

      toast.success(`"${data.name}" created successfully`);
      onSuccess?.();

      if (addAnother) {
        // Reset form but keep dialog open for quick sequential adds
        form.reset();
        cleanupImage();
        form.setFocus("name");
      } else {
        onOpenChange(false);
      }
    } catch (error: unknown) {
      logger.error("Failed to create product", error instanceof Error ? error : new Error(String(error)));
      toast.error(humanizeError(error, "Failed to create product"));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Quick Add Product
          </DialogTitle>
          <DialogDescription>
            Add a product with essential details. You can edit the full details
            later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. Blue Dream 1/8oz"
                      maxLength={200}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="flower">Flower</SelectItem>
                      <SelectItem value="edibles">Edibles</SelectItem>
                      <SelectItem value="vapes">Vapes</SelectItem>
                      <SelectItem value="concentrates">
                        Concentrates
                      </SelectItem>
                      <SelectItem value="pre-rolls">Pre-Rolls</SelectItem>
                      <SelectItem value="topicals">Topicals</SelectItem>
                      <SelectItem value="gear">Gear</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="wholesale_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price *</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="0.00"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="available_quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Quantity</FormLabel>
                  <FormControl>
                    <IntegerInput
                      min={0}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Image Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Product Image
              </label>
              {imagePreview ? (
                <div className="relative group rounded-lg overflow-hidden border">
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="w-full h-40 object-cover"
                  />
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Progress
                        value={uploadProgress}
                        className="w-32"
                      />
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                  <Input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleImageChange}
                    aria-label="Upload product image"
                  />
                  <Upload className="h-5 w-5" />
                  <span className="text-sm">
                    Click to upload (max {MAX_FILE_SIZE_MB}MB)
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={addAnother}
                  onChange={(e) => setAddAnother(e.target.checked)}
                  className="rounded border-input"
                />
                Add another
              </label>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
