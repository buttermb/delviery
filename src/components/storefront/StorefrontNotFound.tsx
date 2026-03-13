/**
 * Storefront Not Found Component
 * Displays when store doesn't exist or page is not found
 */

import { Home, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface StorefrontNotFoundProps {
  type?: '404' | 'store-not-found' | 'product-not-found';
  message?: string | null;
  onNavigateHome?: () => void;
  showSearch?: boolean;
  onSearch?: () => void;
}

export default function StorefrontNotFound({
  type = '404',
  message,
  onNavigateHome,
  showSearch = false,
  onSearch,
}: StorefrontNotFoundProps) {
  const getHeading = () => {
    switch (type) {
      case 'store-not-found':
        return 'Store Not Found';
      case 'product-not-found':
        return 'Product Not Found';
      default:
        return 'Page Not Found';
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'store-not-found':
        return 'The store you're looking for doesn't exist or has been removed.';
      case 'product-not-found':
        return 'The product you're looking for is no longer available.';
      default:
        return 'The page you're looking for doesn't exist or has been moved.';
    }
  };

  const getErrorCode = () => {
    return type === '404' ? '404' : null;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-8 text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
        </div>

        {/* Error Code */}
        {getErrorCode() && (
          <div className="text-8xl font-bold text-muted-foreground/20">
            {getErrorCode()}
          </div>
        )}

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">{getHeading()}</h1>
          <p className="text-muted-foreground">
            {message || getDefaultMessage()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          {onNavigateHome && (
            <Button onClick={onNavigateHome} size="lg" className="gap-2">
              <Home className="h-4 w-4" />
              Go to Homepage
            </Button>
          )}
          {showSearch && onSearch && (
            <Button onClick={onSearch} variant="outline" size="lg" className="gap-2">
              <Search className="h-4 w-4" />
              Search Products
            </Button>
          )}
        </div>

        {/* Help Text */}
        <p className="text-sm text-muted-foreground pt-4">
          If you think this is a mistake, please contact support.
        </p>
      </Card>
    </div>
  );
}
