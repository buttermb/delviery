import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Image, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';

interface ImageUploadHelperProps {
  productsWithoutImages?: string[];
}

export const ImageUploadHelper = ({ productsWithoutImages = [] }: ImageUploadHelperProps) => {
  useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const [expanded, setExpanded] = useState(false);

  if (productsWithoutImages.length === 0) {
    return (
      <Alert className="bg-green-500/10 border-green-500/20">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-900 dark:text-green-100">
          All products have images! Your menu looks great.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-lg">Image Recommendations</CardTitle>
          </div>
          <Badge variant="secondary">
            {productsWithoutImages.length} products need images
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Products with high-quality images see 2-3x higher conversion rates.
            Add images to maximize your menu performance.
          </AlertDescription>
        </Alert>

        {expanded && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Products without images:</div>
            <div className="space-y-1">
              {productsWithoutImages.map((productName) => (
                <div
                  key={productName}
                  className="text-sm text-muted-foreground flex items-center gap-2 p-2 rounded bg-muted/50"
                >
                  <Image className="h-4 w-4" />
                  {productName}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide' : 'Show'} Products
          </Button>
          <Button
            size="sm"
            onClick={() => navigateToAdmin('wholesale-inventory')}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Images
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>

        {/* Quick Tips */}
        <div className="mt-4 p-3 rounded-lg bg-muted/50 space-y-2">
          <div className="text-sm font-medium">Image Tips:</div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-4">
            <li>• Use high-resolution images (minimum 800x800px)</li>
            <li>• Show products from multiple angles</li>
            <li>• Use good lighting and clean backgrounds</li>
            <li>• Images are automatically optimized for fast loading</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
