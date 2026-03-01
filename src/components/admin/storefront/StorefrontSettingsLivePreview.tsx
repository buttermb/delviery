/**
 * Storefront Settings Live Preview
 * Real-time preview of storefront appearance based on current settings.
 * Applies --storefront-* CSS variables to the preview container immediately
 * as settings change, without requiring a save action.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Tablet, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { applyPreviewCSSVariables } from '@/lib/storefrontThemes';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface PreviewProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  category: string | null;
}

interface PreviewSettings {
  store_name: string;
  tagline: string | null;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  theme_config: {
    theme: 'standard' | 'luxury';
    colors?: {
      accent?: string;
    };
  } | null;
  featured_product_ids?: string[];
}

interface StorefrontSettingsLivePreviewProps {
  settings: PreviewSettings;
  featuredProducts?: PreviewProduct[];
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';
type Orientation = 'portrait' | 'landscape';

export function StorefrontSettingsLivePreview({
  settings,
  featuredProducts = [],
}: StorefrontSettingsLivePreviewProps) {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const previewRef = useRef<HTMLDivElement>(null);

  const isLuxury = settings.theme_config?.theme === 'luxury';
  const primaryColor = settings.primary_color || '#10b981';
  const secondaryColor = settings.secondary_color || '#059669';
  const accentColor = settings.accent_color || '#34d399';

  // Apply CSS variables to preview container immediately when settings change
  useEffect(() => {
    if (!previewRef.current) return;

    const bgColor = isLuxury ? '#0a0a0a' : '#ffffff';
    const textColor = isLuxury ? '#ffffff' : '#000000';
    const cardBg = isLuxury ? '#1a1a1a' : '#fafafa';
    const borderColor = isLuxury ? '#333' : '#e5e7eb';

    applyPreviewCSSVariables(previewRef.current, {
      primary: primaryColor,
      secondary: secondaryColor,
      accent: accentColor,
      background: bgColor,
      text: textColor,
      cardBg,
      border: borderColor,
    }, settings.font_family || undefined);
  }, [primaryColor, secondaryColor, accentColor, isLuxury, settings.font_family]);

  const containerWidth = useMemo(() => {
    switch (deviceMode) {
      case 'mobile':
        return orientation === 'portrait' ? 'max-w-[375px]' : 'max-w-[568px]';
      case 'tablet':
        return orientation === 'portrait' ? 'max-w-[768px]' : 'max-w-[900px]';
      default:
        return 'w-full';
    }
  }, [deviceMode, orientation]);

  return (
    <div className="space-y-3">
      {/* Device Mode Selector */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Live Preview</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 mr-1"
            onClick={() => setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')}
            disabled={deviceMode === 'desktop'}
            title="Rotate Orientation"
            aria-label="Rotate orientation"
          >
            <RotateCcw className={`h-3.5 w-3.5 transition-transform ${orientation === 'landscape' ? 'rotate-90' : ''}`} />
          </Button>
          <Button
            variant={deviceMode === 'desktop' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-11 w-11"
            onClick={() => { setDeviceMode('desktop'); setOrientation('portrait'); }}
            aria-label="Desktop preview"
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={deviceMode === 'tablet' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-11 w-11"
            onClick={() => setDeviceMode('tablet')}
            aria-label="Tablet preview"
          >
            <Tablet className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={deviceMode === 'mobile' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-11 w-11"
            onClick={() => setDeviceMode('mobile')}
            aria-label="Mobile preview"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <Card className="overflow-hidden border-2">
        <div className={`mx-auto transition-all duration-300 ${containerWidth}`}>
          {/* Simulated Browser Chrome */}
          <div className="bg-muted/50 border-b px-3 py-1.5 flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-background rounded px-2 py-0.5 text-[10px] text-muted-foreground truncate">
              /shop/{settings.store_name?.toLowerCase().replace(/\s+/g, '-') || 'my-store'}
            </div>
          </div>

          {/* Preview Content — CSS variables scoped to this container */}
          <CardContent className="p-0">
            <div
              ref={previewRef}
              className="transition-colors duration-300"
              style={{
                backgroundColor: 'var(--storefront-bg)',
                color: 'var(--storefront-text)',
              }}
            >
              {/* Nav Bar Preview */}
              <div
                className="flex items-center justify-between px-4 py-2 border-b transition-all duration-300"
                style={{
                  borderColor: 'var(--storefront-border)',
                  backgroundColor: isLuxury ? '#111' : 'var(--storefront-bg)',
                }}
              >
                <div className="flex items-center gap-2">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt={settings.store_name ? `${settings.store_name} logo` : 'Store logo'}
                      className="h-6 w-auto object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: 'var(--storefront-primary)' }}
                    />
                  )}
                  <span
                    className="text-xs font-semibold truncate max-w-[120px]"
                    style={{ color: 'var(--storefront-text)' }}
                  >
                    {settings.store_name || 'Store Name'}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="w-4 h-4 rounded bg-muted/40" />
                  <div
                    className="px-2 py-0.5 rounded-full text-[8px] font-medium"
                    style={{
                      backgroundColor: 'var(--storefront-primary)',
                      color: '#fff',
                    }}
                  >
                    Cart
                  </div>
                </div>
              </div>

              {/* Hero/Banner Preview */}
              <div
                className="relative overflow-hidden transition-all duration-300"
                style={{
                  height: deviceMode === 'mobile' ? '120px' : '160px',
                  backgroundImage: settings.banner_url
                    ? `url(${settings.banner_url})`
                    : `linear-gradient(135deg, var(--storefront-primary), var(--storefront-secondary))`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/30" />
                <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
                  <h3
                    className="text-white font-bold text-sm md:text-base drop-shadow-lg"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                  >
                    {settings.store_name || 'Your Store'}
                  </h3>
                  {settings.tagline && (
                    <p className="text-white/80 text-[10px] mt-1 drop-shadow">
                      {settings.tagline}
                    </p>
                  )}
                  <div
                    className="mt-2 px-3 py-1 rounded-full text-[9px] font-medium text-white"
                    style={{ backgroundColor: 'var(--storefront-accent)' }}
                  >
                    Shop Now
                  </div>
                </div>
              </div>

              {/* Featured Products Preview */}
              {featuredProducts.length > 0 && (
                <div className="px-3 py-3">
                  <h4
                    className="text-[10px] font-semibold mb-2 uppercase tracking-wider"
                    style={{ color: isLuxury ? '#ccc' : '#666' }}
                  >
                    Featured Products
                  </h4>
                  <div
                    className={`grid gap-2 ${deviceMode === 'mobile' ? 'grid-cols-2' : 'grid-cols-3'
                      }`}
                  >
                    {featuredProducts.slice(0, deviceMode === 'mobile' ? 2 : 3).map((product) => (
                      <div
                        key={product.id}
                        className="rounded-lg overflow-hidden border transition-all duration-300"
                        style={{
                          borderColor: 'var(--storefront-border)',
                          backgroundColor: 'var(--storefront-card-bg)',
                        }}
                      >
                        <div
                          className="h-14 bg-muted/30 flex items-center justify-center"
                          style={{
                            backgroundImage: product.image_url
                              ? `url(${product.image_url})`
                              : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        >
                          {!product.image_url && (
                            <div className="w-6 h-6 rounded bg-muted/50" />
                          )}
                        </div>
                        <div className="p-1.5">
                          <p
                            className="text-[8px] font-medium truncate"
                            style={{ color: isLuxury ? '#eee' : '#333' }}
                          >
                            {product.name}
                          </p>
                          <p
                            className="text-[8px] font-bold"
                            style={{ color: 'var(--storefront-primary)' }}
                          >
                            {formatCurrency(product.price)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* If no featured products, show placeholder grid */}
              {featuredProducts.length === 0 && (
                <div className="px-3 py-3">
                  <h4
                    className="text-[10px] font-semibold mb-2 uppercase tracking-wider"
                    style={{ color: isLuxury ? '#ccc' : '#666' }}
                  >
                    Featured Products
                  </h4>
                  <div
                    className={`grid gap-2 ${deviceMode === 'mobile' ? 'grid-cols-2' : 'grid-cols-3'
                      }`}
                  >
                    {Array.from({ length: deviceMode === 'mobile' ? 2 : 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-lg overflow-hidden border"
                        style={{
                          borderColor: 'var(--storefront-border)',
                          backgroundColor: 'var(--storefront-card-bg)',
                        }}
                      >
                        <div className="h-14 bg-muted/20" />
                        <div className="p-1.5 space-y-1">
                          <div className="h-2 w-3/4 bg-muted/30 rounded" />
                          <div className="h-2 w-1/2 bg-muted/20 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Swatches */}
              <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--storefront-border)' }}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-muted-foreground">Theme:</span>
                  <div
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: 'var(--storefront-primary)', borderColor: isLuxury ? '#555' : '#ccc' }}
                    title="Primary"
                  />
                  <div
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: 'var(--storefront-secondary)', borderColor: isLuxury ? '#555' : '#ccc' }}
                    title="Secondary"
                  />
                  <div
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: 'var(--storefront-accent)', borderColor: isLuxury ? '#555' : '#ccc' }}
                    title="Accent"
                  />
                  <Badge variant="outline" className="text-[7px] h-3 px-1 ml-1">
                    {isLuxury ? 'Luxury' : 'Standard'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
