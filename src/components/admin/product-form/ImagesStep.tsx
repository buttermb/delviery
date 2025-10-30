import { useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImagesStepProps {
  formData: any;
  updateFormData: (data: any) => void;
}

export function ImagesStep({ formData, updateFormData }: ImagesStepProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const uploadImage = async (file: File, isMain = false) => {
    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `product-images/${fileName}`;

      console.log("Uploading image:", { fileName, filePath, isMain });

      const { error: uploadError, data } = await supabase.storage
        .from("product-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      console.log("Image uploaded successfully:", { publicUrl, isMain });

      // Update form data immediately and persistently
      if (isMain) {
        const newData = { image_url: publicUrl };
        console.log("Updating main image in form data:", newData);
        updateFormData(newData);
      } else {
        const currentImages = formData.images || [];
        const newImages = [...currentImages, publicUrl];
        console.log("Updating additional images:", newImages);
        updateFormData({ images: newImages });
      }

      toast({ title: "✓ Image uploaded successfully" });
    } catch (error: any) {
      console.error("Image upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent, isMain = false) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && files[0].type.startsWith("image/")) {
        uploadImage(files[0], isMain);
      }
    },
    [uploadImage]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isMain = false) => {
    const files = e.target.files;
    if (files && files[0]) {
      uploadImage(files[0], isMain);
    }
  };

  const removeImage = (index: number) => {
    const currentImages = formData.images || [];
    updateFormData({ images: currentImages.filter((_: any, i: number) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Product Images</h2>
        <p className="text-muted-foreground">
          Upload high-quality images of your product
        </p>
      </div>

      {/* Main Image */}
      <div>
        <Label>Main Product Image *</Label>
        <Card
          className={`mt-3 border-2 border-dashed transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={(e) => handleDrop(e, true)}
        >
          {formData.image_url ? (
            <div className="relative group">
              <img
                src={formData.image_url}
                alt="Product"
                className="w-full h-64 object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  onClick={() => updateFormData({ image_url: "" })}
                  variant="destructive"
                  size="sm"
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center">
              <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Drag & Drop Image Here</p>
              <p className="text-sm text-muted-foreground mb-4">or</p>
              <label htmlFor="main-image">
                <Button variant="outline" disabled={uploading} asChild>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading..." : "Browse Files"}
                  </span>
                </Button>
              </label>
              <input
                id="main-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, true)}
              />
              <p className="text-xs text-muted-foreground mt-4">
                Recommended: 1000x1000px, JPG/PNG, Max 5MB
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Additional Images */}
      <div>
        <Label>Additional Images (Optional)</Label>
        <p className="text-sm text-muted-foreground mb-3">
          Upload up to 5 additional product photos
        </p>
        <div className="grid grid-cols-5 gap-3">
          {formData.images?.map((img: string, index: number) => (
            <div key={index} className="relative group">
              <img
                src={img}
                alt={`Product ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {(formData.images?.length || 0) < 5 && (
            <label htmlFor="additional-images">
              <Card className="h-24 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors border-2 border-dashed">
                <div className="text-center">
                  <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Add</p>
                </div>
              </Card>
              <input
                id="additional-images"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e, false)}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
