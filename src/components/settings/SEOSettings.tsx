import { Card } from '@/components/ui/card';
import { Search } from 'lucide-react';

export function SEOSettings() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Search className="h-5 w-5" />
        SEO Settings for Storefront
      </h3>
      <p className="text-muted-foreground">
        Optimize your storefront for search engines with meta tags, descriptions, and keywords.
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        Coming soon: Configure SEO metadata to improve your storefront's search rankings.
      </div>
    </Card>
  );
}
