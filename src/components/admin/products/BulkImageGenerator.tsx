import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useBulkGenerateImages } from "@/hooks/useProductImages";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import X from "lucide-react/dist/esm/icons/x";

interface Product {
  id: string;
  name: string;
  category: string;
  strain_type?: string;
  image_url?: string | null;
}

interface BulkImageGeneratorProps {
  products: Product[];
}

export const BulkImageGenerator = ({ products }: BulkImageGeneratorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const { mutate: generateImages, isPending } = useBulkGenerateImages();

  const productsWithoutImages = products.filter(p => !p.image_url);

  const handleGenerate = () => {
    if (productsWithoutImages.length === 0) {
      return;
    }

    setProgress(0);
    setIsOpen(true);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + (100 / productsWithoutImages.length);
      });
    }, 2000);

    // Map products to the format expected by the hook
    const formattedProducts = productsWithoutImages.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      strain_type: p.strain_type
    }));

    generateImages(formattedProducts, {
      onSuccess: () => {
        clearInterval(progressInterval);
        setProgress(100);
        setTimeout(() => {
          setIsOpen(false);
          setProgress(0);
        }, 2000);
      },
      onError: () => {
        clearInterval(progressInterval);
      }
    });
  };

  return (
    <>
      <Button
        onClick={handleGenerate}
        disabled={productsWithoutImages.length === 0}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Generate All Images ({productsWithoutImages.length})
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generating Product Images</DialogTitle>
            <DialogDescription>
              Using AI to create professional product images. This may take a few minutes...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Generating images for {productsWithoutImages.length} products</p>
              <p className="mt-2">This process includes:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>AI image generation</li>
                <li>Image optimization</li>
                <li>Storage upload</li>
                <li>Database update</li>
              </ul>
            </div>

            {!isPending && progress === 100 && (
              <div className="text-center text-success font-medium">
                ✓ All images generated successfully!
              </div>
            )}
          </div>

          {isPending && (
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Run in Background
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
