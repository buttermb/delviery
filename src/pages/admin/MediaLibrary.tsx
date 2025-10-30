import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Trash2, Download, Search, Image as ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function MediaLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Setup realtime subscription with proper cleanup
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupChannel = async () => {
      channel = supabase
        .channel('products-media-changes', {
          config: {
            broadcast: { self: false },
            presence: { key: '' }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'products'
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["admin-products"] });
            queryClient.invalidateQueries({ queryKey: ["media-library"] });
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to products media channel');
          }
        });
    };

    setupChannel();

    return () => {
      if (channel) {
        supabase.removeChannel(channel).then(() => {
          channel = null;
        });
      }
    };
  }, [queryClient]);

  // Get all product images
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: images } = useQuery({
    queryKey: ["media-library"],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("product-images")
        .list("product-images", { limit: 1000 });
      
      if (error) throw error;
      
      return data.map((file) => {
        const { data: { publicUrl } } = supabase.storage
          .from("product-images")
          .getPublicUrl(`product-images/${file.name}`);
        
        const isUsed = products?.some(
          (p) => p.image_url === publicUrl || p.images?.includes(publicUrl)
        );
        
        return {
          name: file.name,
          url: publicUrl,
          size: file.metadata?.size || 0,
          created: file.created_at,
          isUsed,
        };
      });
    },
    enabled: !!products,
  });

  const uploadImage = async (file: File) => {
    const uploadId = crypto.randomUUID();
    try {
      setUploading(true);
      setUploadProgress(prev => ({ ...prev, [uploadId]: 0 }));
      
      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image must be less than 10MB');
      }

      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `product-images/${fileName}`;

      setUploadProgress(prev => ({ ...prev, [uploadId]: 50 }));

      const { error } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      setUploadProgress(prev => ({ ...prev, [uploadId]: 100 }));

      await queryClient.refetchQueries({ queryKey: ["media-library"] });
      toast({ 
        title: "✓ Image uploaded",
        description: file.name 
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[uploadId];
          return newProgress;
        });
      }, 1000);
    }
  };

  const deleteImages = useMutation({
    mutationFn: async (urls: string[]) => {
      const filePaths = urls.map((url) => {
        const parts = url.split("/");
        return `product-images/${parts[parts.length - 1]}`;
      });

      for (const path of filePaths) {
        const { error } = await supabase.storage
          .from("product-images")
          .remove([path]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-library"] });
      toast({ title: "Images deleted successfully" });
      setSelectedImages([]);
    },
  });

  const filteredImages = images?.filter((img) => {
    const matchesSearch = img.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "used" && img.isUsed) ||
      (filter === "unused" && !img.isUsed);
    return matchesSearch && matchesFilter;
  });

  const toggleImageSelection = (url: string) => {
    setSelectedImages((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Media Library</h1>
          <p className="text-muted-foreground">
            {images?.length || 0} images • {images?.filter((i) => !i.isUsed).length || 0} unused
          </p>
        </div>
        <label htmlFor="upload-images">
          <Button disabled={uploading} asChild>
            <span>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Images
                </>
              )}
            </span>
          </Button>
        </label>
        <input
          id="upload-images"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach((file) => uploadImage(file));
          }}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Images</SelectItem>
            <SelectItem value="used">Used</SelectItem>
            <SelectItem value="unused">Unused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedImages.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{selectedImages.length} images selected</span>
            <Button
              onClick={() => {
                if (confirm("Delete selected images?")) {
                  deleteImages.mutate(selectedImages);
                }
              }}
              variant="destructive"
              size="sm"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        </Card>
      )}

      {/* Images Grid */}
      {filteredImages && filteredImages.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredImages.map((image) => (
            <Card
              key={image.url}
              className="overflow-hidden cursor-pointer hover:ring-2 ring-primary"
              onClick={() => toggleImageSelection(image.url)}
            >
              <div className="relative">
                <input
                  type="checkbox"
                  checked={selectedImages.includes(image.url)}
                  onChange={() => toggleImageSelection(image.url)}
                  className="absolute top-2 left-2 z-10 h-4 w-4"
                  onClick={(e) => e.stopPropagation()}
                />
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-full h-32 object-cover"
                />
                <div className="absolute top-2 right-2">
                  <Badge variant={image.isUsed ? "default" : "secondary"}>
                    {image.isUsed ? "Used" : "Unused"}
                  </Badge>
                </div>
              </div>
              <div className="p-2">
                <p className="text-xs truncate">{image.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(image.size / 1024).toFixed(0)} KB
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No images found</p>
        </Card>
      )}
    </div>
  );
}
