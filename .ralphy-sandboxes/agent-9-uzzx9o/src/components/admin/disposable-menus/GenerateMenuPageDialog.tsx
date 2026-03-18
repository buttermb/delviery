import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useProductsForMenu } from '@/hooks/useProductsForMenu';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import {
  FileText, Search, Copy, ExternalLink, Loader2, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';

// ---------- Color scheme presets ----------

interface ColorScheme {
  id: string;
  name: string;
  bg: string;
  text: string;
  accent: string;
  cardBg: string;
  border: string;
  preview: string; // tailwind classes for the preview dot
}

const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'light',
    name: 'Light',
    bg: '#f8f9fa',
    text: '#1a1a2e',
    accent: '#059669',
    cardBg: '#ffffff',
    border: '#e5e7eb',
    preview: 'bg-gray-100 border-gray-300',
  },
  {
    id: 'dark',
    name: 'Dark',
    bg: '#0f172a',
    text: '#f1f5f9',
    accent: '#22c55e',
    cardBg: '#1e293b',
    border: '#334155',
    preview: 'bg-slate-800 border-slate-600',
  },
  {
    id: 'warm',
    name: 'Warm',
    bg: '#fefce8',
    text: '#422006',
    accent: '#ca8a04',
    cardBg: '#ffffff',
    border: '#fde68a',
    preview: 'bg-yellow-50 border-yellow-300',
  },
  {
    id: 'mint',
    name: 'Mint',
    bg: '#f0fdf4',
    text: '#14532d',
    accent: '#16a34a',
    cardBg: '#ffffff',
    border: '#bbf7d0',
    preview: 'bg-green-50 border-green-300',
  },
];

// ---------- Types ----------

interface GenerateMenuPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select products from an existing menu */
  preselectedMenuId?: string;
  preselectedMenuName?: string;
}

interface DisplayOptions {
  showPrices: boolean;
  showDescriptions: boolean;
  showImages: boolean;
}

// ---------- Component ----------

export function GenerateMenuPageDialog({
  open,
  onOpenChange,
  preselectedMenuName,
}: GenerateMenuPageDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const { data: products = [], isLoading: productsLoading } = useProductsForMenu(tenant?.id);

  // Core fields
  const [title, setTitle] = useState(preselectedMenuName ?? '');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Display options
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    showPrices: true,
    showDescriptions: true,
    showImages: true,
  });

  // Color scheme
  const [colorSchemeId, setColorSchemeId] = useState('light');

  // Contact info & custom message
  const [contactInfo, setContactInfo] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const toggleProduct = (id: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedProducts(new Set(filteredProducts.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedProducts(new Set());
  };

  const toggleDisplayOption = (key: keyof DisplayOptions) => {
    setDisplayOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    if (!tenant?.id || selectedProducts.size === 0 || !title.trim()) return;

    const selectedScheme = COLOR_SCHEMES.find((s) => s.id === colorSchemeId) ?? COLOR_SCHEMES[0];

    setIsGenerating(true);
    try {
      // Create a disposable menu via the edge function with static_page menu_type
      const { data, error } = await supabase.functions.invoke('create-encrypted-menu', {
        body: {
          tenant_id: tenant.id,
          name: title.trim(),
          description: `Static menu page: ${title.trim()}`,
          custom_message: customMessage.trim() || undefined,
          show_product_images: displayOptions.showImages,
          products: Array.from(selectedProducts).map((pid, idx) => ({
            product_id: pid,
            display_availability: true,
            display_order: idx,
          })),
          security_settings: { menu_type: 'static_page' },
          appearance_settings: {
            color_scheme: selectedScheme.id,
            colors: {
              bg: selectedScheme.bg,
              text: selectedScheme.text,
              accent: selectedScheme.accent,
              cardBg: selectedScheme.cardBg,
              border: selectedScheme.border,
            },
            show_prices: displayOptions.showPrices,
            show_descriptions: displayOptions.showDescriptions,
            contact_info: contactInfo.trim() || undefined,
          },
          access_code: generateAccessCode(),
          never_expires: true,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate page');

      const urlToken = data?.url_token ?? data?.menu?.encrypted_url_token;
      if (!urlToken) throw new Error('No URL token returned');

      // Build the static page URL using the edge function endpoint
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
      const staticPageUrl = `${supabaseUrl}/functions/v1/serve-menu-page?token=${urlToken}`;
      setGeneratedUrl(staticPageUrl);

      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      toast.success('Menu page generated!');
      logger.info('Static menu page generated', {
        component: 'GenerateMenuPageDialog',
        menuTitle: title.trim(),
        productCount: selectedProducts.size,
        colorScheme: selectedScheme.id,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate page';
      toast.error(message);
      logger.error('Static menu page generation failed', {
        component: 'GenerateMenuPageDialog',
        error: message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenPage = () => {
    if (!generatedUrl) return;
    window.open(generatedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleClose = (value: boolean) => {
    if (!value) {
      // Reset state on close
      setTitle(preselectedMenuName ?? '');
      setSelectedProducts(new Set());
      setSearchQuery('');
      setDisplayOptions({ showPrices: true, showDescriptions: true, showImages: true });
      setColorSchemeId('light');
      setContactInfo('');
      setCustomMessage('');
      setGeneratedUrl(null);
      setCopied(false);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generate Menu Page
          </DialogTitle>
        </DialogHeader>

        {generatedUrl ? (
          /* Success state — show the URL */
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <Check className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-semibold text-lg">Page Generated!</h3>
              <p className="text-sm text-muted-foreground">
                Share this link — it loads as a fast, clean HTML page with no login required.
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Input
                value={generatedUrl}
                readOnly
                className="text-xs bg-transparent border-0 focus-visible:ring-0"
              />
              <Button size="sm" variant="outline" onClick={handleCopyUrl}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="outline" onClick={handleOpenPage}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          /* Creation form */
          <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="page-title">Page Title</Label>
              <Input
                id="page-title"
                placeholder="e.g. Weekly Specials"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            {/* Product selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Products</Label>
                <div className="flex gap-2">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={selectAll}>
                    Select all
                  </Button>
                  <span className="text-muted-foreground text-xs">/</span>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={deselectAll}>
                    Clear
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {productsLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {searchQuery ? 'No products match your search' : 'No products available'}
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <label
                      key={product.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors',
                        selectedProducts.has(product.id) && 'bg-primary/5'
                      )}
                    >
                      <Checkbox
                        checked={selectedProducts.has(product.id)}
                        onCheckedChange={() => toggleProduct(product.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{product.name}</div>
                        {product.category && (
                          <span className="text-xs text-muted-foreground">{product.category}</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-success shrink-0">
                        {formatCurrency(product.price)}
                      </span>
                    </label>
                  ))
                )}
              </div>

              {selectedProducts.size > 0 && (
                <Badge variant="secondary" className="w-fit">
                  {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
                </Badge>
              )}
            </div>

            <Separator />

            {/* Display options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Display Options</Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-prices" className="text-sm font-normal cursor-pointer">
                    Show prices
                  </Label>
                  <Switch
                    id="toggle-prices"
                    checked={displayOptions.showPrices}
                    onCheckedChange={() => toggleDisplayOption('showPrices')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-descriptions" className="text-sm font-normal cursor-pointer">
                    Show descriptions
                  </Label>
                  <Switch
                    id="toggle-descriptions"
                    checked={displayOptions.showDescriptions}
                    onCheckedChange={() => toggleDisplayOption('showDescriptions')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="toggle-images" className="text-sm font-normal cursor-pointer">
                    Show product images
                  </Label>
                  <Switch
                    id="toggle-images"
                    checked={displayOptions.showImages}
                    onCheckedChange={() => toggleDisplayOption('showImages')}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Color scheme */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Color Scheme</Label>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_SCHEMES.map((scheme) => (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => setColorSchemeId(scheme.id)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all text-xs',
                      colorSchemeId === scheme.id
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <div
                      className={cn('w-8 h-8 rounded-full border-2', scheme.preview)}
                      style={{ backgroundColor: scheme.bg }}
                    />
                    <span className="font-medium">{scheme.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Contact info */}
            <div className="space-y-1.5">
              <Label htmlFor="contact-info">Contact Info (optional)</Label>
              <Input
                id="contact-info"
                placeholder="e.g. Call us: (555) 123-4567"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Shown at the bottom of the page</p>
            </div>

            {/* Custom message */}
            <div className="space-y-1.5">
              <Label htmlFor="custom-message">Custom Message (optional)</Label>
              <Textarea
                id="custom-message"
                placeholder="e.g. Free delivery on orders over $100!"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Displayed as a highlighted banner</p>
            </div>
          </div>
        )}

        <DialogFooter>
          {generatedUrl ? (
            <Button onClick={() => handleClose(false)}>Done</Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || selectedProducts.size === 0 || !title.trim()}
            >
              {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Page
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
