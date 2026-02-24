/**
 * Google Search Preview Component
 * Shows a preview of how the store will appear in Google search results
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';

interface GoogleSearchPreviewProps {
  title: string;
  description: string;
  url: string;
  faviconUrl?: string | null;
}

export function GoogleSearchPreview({
  title,
  description,
  url,
  faviconUrl,
}: GoogleSearchPreviewProps) {
  // Google truncates titles around 60 characters and descriptions around 155-160 characters
  const displayTitle = title || 'Your Store Name';
  const displayDescription = description || 'Add a meta description to help search engines understand what your store is about. This text appears in search results.';
  const displayUrl = url || 'example.com/shop/your-store';

  // Truncate for display (mimicking Google's behavior)
  const truncatedTitle = displayTitle.length > 60
    ? displayTitle.substring(0, 57) + '...'
    : displayTitle;
  const truncatedDescription = displayDescription.length > 160
    ? displayDescription.substring(0, 157) + '...'
    : displayDescription;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="w-4 h-4" />
          Search Result Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-white rounded-lg p-4 border">
          {/* Google Search Result Mockup */}
          <div className="space-y-1">
            {/* URL line with favicon */}
            <div className="flex items-center gap-2">
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt="Site favicon"
                  className="w-7 h-7 rounded-full object-contain bg-gray-100 p-1"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                  loading="lazy"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-gray-300" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm text-gray-800">
                  {displayUrl.replace(/^https?:\/\//, '').split('/')[0]}
                </span>
                <span className="text-xs text-gray-500 truncate max-w-[280px]">
                  {displayUrl}
                </span>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl text-[#1a0dab] hover:underline cursor-pointer leading-tight">
              {truncatedTitle}
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-600 leading-relaxed">
              {truncatedDescription}
            </p>
          </div>
        </div>

        {/* Character counts */}
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>Title:</span>
            <span className={displayTitle.length > 60 ? 'text-amber-600 font-medium' : ''}>
              {displayTitle.length}/60
            </span>
            {displayTitle.length > 60 && (
              <span className="text-amber-600">(truncated)</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span>Description:</span>
            <span className={displayDescription.length > 160 ? 'text-amber-600 font-medium' : ''}>
              {displayDescription.length}/160
            </span>
            {displayDescription.length > 160 && (
              <span className="text-amber-600">(truncated)</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
