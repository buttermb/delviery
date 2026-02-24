/**
 * OG Image Preview Component
 * Shows social share preview cards for Facebook, Twitter, and LinkedIn
 * Displays how the store will appear when shared on social media
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Globe, ImageOff } from 'lucide-react';

interface OGImagePreviewProps {
  title: string;
  description: string;
  imageUrl: string | null;
  siteUrl: string;
  siteName: string;
}

export function OGImagePreview({
  title,
  description,
  imageUrl,
  siteUrl,
  siteName,
}: OGImagePreviewProps) {
  const displayTitle = title || siteName || 'Your Store';
  const displayDescription = description || 'Welcome to our store. Browse our products and place your order today.';
  const truncatedDescription = displayDescription.length > 150
    ? displayDescription.slice(0, 147) + '...'
    : displayDescription;
  const truncatedDescriptionTwitter = displayDescription.length > 100
    ? displayDescription.slice(0, 97) + '...'
    : displayDescription;
  const displayUrl = siteUrl || 'floraiq.com/shop/your-store';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Social Share Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="facebook" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="facebook" className="text-xs">Facebook</TabsTrigger>
            <TabsTrigger value="twitter" className="text-xs">Twitter/X</TabsTrigger>
            <TabsTrigger value="linkedin" className="text-xs">LinkedIn</TabsTrigger>
          </TabsList>

          {/* Facebook Preview */}
          <TabsContent value="facebook" className="mt-3">
            <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
              {/* Image Container - 1.91:1 aspect ratio for Facebook */}
              <div className="relative w-full" style={{ paddingBottom: '52.36%' }}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="OG Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.classList.add('bg-muted', 'flex', 'items-center', 'justify-center');
                        const placeholder = document.createElement('div');
                        placeholder.className = 'flex flex-col items-center gap-2 text-muted-foreground';
                        placeholder.innerHTML = '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><span class="text-xs">No image set</span>';
                        parent.appendChild(placeholder);
                      }
                    }}
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="w-8 h-8" />
                    <span className="text-xs">No image set</span>
                  </div>
                )}
              </div>
              {/* Content */}
              <div className="p-3 bg-gray-100 border-t">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide truncate">
                  {displayUrl.replace(/^https?:\/\//, '').split('/')[0]}
                </p>
                <h4 className="text-[15px] font-semibold text-gray-900 leading-tight mt-0.5 line-clamp-2">
                  {displayTitle}
                </h4>
                <p className="text-[13px] text-gray-500 mt-0.5 line-clamp-2">
                  {truncatedDescription}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Facebook • Recommended: 1200×630px
            </p>
          </TabsContent>

          {/* Twitter/X Preview */}
          <TabsContent value="twitter" className="mt-3">
            <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
              {/* Image Container - 2:1 aspect ratio for Twitter large card */}
              <div className="relative w-full" style={{ paddingBottom: '50%' }}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="OG Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.classList.add('bg-muted', 'flex', 'items-center', 'justify-center');
                      }
                    }}
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="w-8 h-8" />
                    <span className="text-xs">No image set</span>
                  </div>
                )}
              </div>
              {/* Content */}
              <div className="p-3 border-t">
                <h4 className="text-[15px] font-bold text-gray-900 leading-tight line-clamp-2">
                  {displayTitle}
                </h4>
                <p className="text-[14px] text-gray-500 mt-0.5 line-clamp-2">
                  {truncatedDescriptionTwitter}
                </p>
                <p className="text-[13px] text-gray-400 mt-1 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {displayUrl.replace(/^https?:\/\//, '').split('/')[0]}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Twitter/X • Recommended: 1200×600px
            </p>
          </TabsContent>

          {/* LinkedIn Preview */}
          <TabsContent value="linkedin" className="mt-3">
            <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
              {/* Image Container - 1.91:1 aspect ratio for LinkedIn */}
              <div className="relative w-full" style={{ paddingBottom: '52.36%' }}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="OG Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.classList.add('bg-muted', 'flex', 'items-center', 'justify-center');
                      }
                    }}
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageOff className="w-8 h-8" />
                    <span className="text-xs">No image set</span>
                  </div>
                )}
              </div>
              {/* Content */}
              <div className="p-3 bg-white border-t">
                <h4 className="text-[14px] font-semibold text-gray-900 leading-tight line-clamp-2">
                  {displayTitle}
                </h4>
                <p className="text-[12px] text-gray-600 mt-1 line-clamp-2">
                  {truncatedDescription}
                </p>
                <p className="text-[11px] text-gray-400 mt-1.5 truncate">
                  {displayUrl.replace(/^https?:\/\//, '')}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              LinkedIn • Recommended: 1200×627px
            </p>
          </TabsContent>
        </Tabs>

        {/* Tips */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
          <h5 className="text-xs font-medium flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Tips</Badge>
          </h5>
          <ul className="text-[11px] text-muted-foreground space-y-1">
            <li>• Use a 1200×630px image for best results across platforms</li>
            <li>• Keep important content centered to avoid cropping</li>
            <li>• Include your brand logo or store name in the image</li>
            <li>• Use high contrast text for readability</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
