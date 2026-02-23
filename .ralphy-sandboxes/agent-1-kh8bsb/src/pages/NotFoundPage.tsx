import { logger } from '@/lib/logger';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Home, ArrowLeft, Search, ShoppingBag, Package, HelpCircle } from 'lucide-react';
import FloraIQLogo from '@/components/FloraIQLogo';
import bugFinder from '@/utils/bugFinder';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');

  // Derive tenant slug from URL params or path for admin quick links
  const slug = useMemo(() => {
    if (tenantSlug) return tenantSlug;
    // Try to extract slug from path: /:slug/admin/...
    const match = location.pathname.match(/^\/([^/]+)\/admin/);
    return match?.[1] || null;
  }, [tenantSlug, location.pathname]);

  useEffect(() => {
    logger.error('404 Error: User attempted to access non-existent route', { pathname: location.pathname, component: 'NotFoundPage' });
    bugFinder.report404(location.pathname, {
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
    });
  }, [location.pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?q=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-12 pb-12 px-6 text-center space-y-8">
          {/* Branding */}
          <div className="flex justify-center">
            <FloraIQLogo size="lg" />
          </div>

          {/* 404 Display */}
          <div className="space-y-4">
            <h1 className="text-8xl font-bold text-primary">404</h1>
            <h2 className="text-3xl font-semibold">Page Not Found</h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
            <Input
              placeholder="Search for a page..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="outline" className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>

          {/* Helpful Links — only show if we can determine the tenant slug */}
          {slug && (
            <div className="pt-8 border-t space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Quick Links:</p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/${slug}/admin/dashboard`)}
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/${slug}/admin/orders`)}
                  className="gap-2"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Orders
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/${slug}/admin/inventory-hub`)}
                  className="gap-2"
                >
                  <Package className="h-4 w-4" />
                  Products
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/${slug}/admin/help-hub`)}
                  className="gap-2"
                >
                  <HelpCircle className="h-4 w-4" />
                  Help
                </Button>
              </div>
            </div>
          )}

          {/* Error Details (for debugging) */}
          {import.meta.env.DEV && (
            <div className="pt-4 border-t text-left">
              <p className="text-xs text-muted-foreground font-mono">
                Attempted path: {location.pathname}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

