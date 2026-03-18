/**
 * Quick Create Menu - Mobile-first design with template quick-select
 * Optimized for touch with large tap targets and swipe gestures
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useFreeTierLimits } from '@/hooks/useFreeTierLimits';
import { TEMPLATES, type MenuTemplate } from './MenuTemplates';
import {
  ChevronDown, ChevronUp, Loader2, Check, Package,
  Shield, Copy, Sparkles, Truck, Zap, Crown, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { queryKeys } from '@/lib/queryKeys';

interface MenuProductItem {
  id: string;
  product_name: string;
  base_price: number;
  quantity_lbs: number;
  category: string | null;
}

interface QuickCreateMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickCreateMenu({ open, onOpenChange }: QuickCreateMenuProps) {
  const { tenant } = useTenantAdminAuth();
  const createMenu = useCreateDisposableMenu();
  const { checkLimit, recordAction, limitsApply } = useFreeTierLimits();

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState<MenuTemplate | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [neverExpires, setNeverExpires] = useState(true);
  const [expirationDays, setExpirationDays] = useState('30');
  const [requireGeofence, setRequireGeofence] = useState(false);
  const [maxViews, setMaxViews] = useState<number | null>(null);

  // OPSEC settings from template
  const [screenshotProtection, setScreenshotProtection] = useState(true);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [deviceFingerprinting, setDeviceFingerprinting] = useState(true);

  // Section open states
  const [productsOpen, setProductsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  // Template icon map for quick-select
  const templateIcons: Record<string, typeof Truck> = {
    'delivery-menu': Truck,
    'popup-event': MapPin,
    'wholesale-drop': Crown,
    'member-club': Sparkles,
    'custom': Zap,
  };

  // Apply template settings
  const applyTemplate = (template: MenuTemplate) => {
    setSelectedTemplate(template);
    setNeverExpires(template.expirationDays >= 30);
    setExpirationDays(template.expirationDays.toString());
    setMaxViews(template.maxViews === 'unlimited' ? null : template.maxViews);
    setRequireGeofence(template.security_settings.require_geofence);
    setScreenshotProtection(template.security_settings.screenshot_protection_enabled);
    setWatermarkEnabled(template.security_settings.watermark_enabled);
    setDeviceFingerprinting(template.security_settings.device_fingerprinting);
    setProductsOpen(true); // Auto-open products after template select
    toast.success(`${template.name} template applied!`);
  };

  // Generate access code
  const generateAccessCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };
  const [accessCode] = useState(generateAccessCode());

  // Fetch products from products table (unified with Product Management, POS, Migration)
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: queryKeys.menuProducts.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, wholesale_price, price, available_quantity, stock_quantity, category')
        .eq('tenant_id', tenant.id)
        .order('name');
      if (error) throw error;
      // Map to consistent interface
      return (data ?? []).map(p => ({
        id: p.id,
        product_name: p.name,
        base_price: p.wholesale_price || p.price || 0,
        quantity_lbs: p.available_quantity || p.stock_quantity || 0,
        category: p.category,
      }));
    },
    enabled: !!tenant?.id && open,
  });

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const query = productSearch.toLowerCase();
    return products.filter((p: MenuProductItem) =>
      p.product_name?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  // Toggle product selection
  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Please enter a menu name');
      return;
    }

    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    if (!tenant?.id) {
      toast.error('No tenant context');
      return;
    }

    // Check free tier daily limit (users with purchased credits bypass limits)
    if (limitsApply) {
      const limitCheck = checkLimit('menus_per_day');
      if (!limitCheck.allowed) {
        toast.error('Daily Menu Limit Reached', {
          description: limitCheck.message,
        });
        return;
      }
    }

    try {
      await createMenu.mutateAsync({
        tenant_id: tenant.id,
        name: name.trim(),
        description: description.trim() || undefined,
        product_ids: selectedProducts,
        access_code: accessCode,
        never_expires: neverExpires,
        expiration_date: neverExpires
          ? undefined
          : new Date(Date.now() + parseInt(expirationDays) * 24 * 60 * 60 * 1000).toISOString(),
        security_settings: {
          require_geofence: requireGeofence,
          max_views: maxViews,
          screenshot_protection_enabled: screenshotProtection,
          watermark_enabled: watermarkEnabled,
          device_fingerprinting: deviceFingerprinting,
        },
      });

      // Record action for free tier limit tracking
      if (limitsApply) {
        await recordAction('menu');
      }

      // Reset and close
      setName('');
      setDescription('');
      setSelectedProducts([]);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to create menu', { description: humanizeError(error) });
    }
  };

  // Reset form when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('');
      setDescription('');
      setSelectedProducts([]);
      setProductSearch('');
      setProductsOpen(false);
      setSecurityOpen(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Quick Create Menu
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 pb-6">
            {/* Template Quick-Select - Mobile optimized horizontal scroll */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Quick Start Template
              </Label>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                {TEMPLATES.slice(0, 4).map((template) => {
                  const Icon = templateIcons[template.id] || Sparkles;
                  const isSelected = selectedTemplate?.id === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className={cn(
                        "flex-shrink-0 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all min-w-[80px]",
                        "active:scale-95 touch-manipulation", // Mobile touch optimization
                        isSelected
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                          : "border-muted hover:border-muted-foreground/30"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-lg",
                        isSelected ? "bg-violet-500 text-white" : "bg-muted"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium truncate max-w-[70px]">
                        {template.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedTemplate && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">
                    {selectedTemplate.tagline}
                  </Badge>
                </div>
              )}
            </div>

            {/* Basic Info - Always visible */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Menu Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., VIP Spring Collection"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description for your reference..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Access Code Preview */}
              <Card className="p-3 bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Access Code</div>
                    <div className="font-mono font-bold text-lg">{accessCode}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(accessCode);
                      toast.success('Access code copied!');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </div>

            {/* Products Section - Collapsible */}
            <Collapsible open={productsOpen} onOpenChange={setProductsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span>Products</span>
                    {selectedProducts.length > 0 && (
                      <Badge variant="secondary">{selectedProducts.length} selected</Badge>
                    )}
                  </div>
                  {productsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="space-y-3">
                  <Input
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />

                  {productsLoading ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </div>
                  ) : (
                    <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
                      {filteredProducts.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          No products found
                        </div>
                      ) : (
                        filteredProducts.map((product: MenuProductItem) => {
                          const isSelected = selectedProducts.includes(product.id);
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => toggleProduct(product.id)}
                              className={cn(
                                "w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors",
                                isSelected ? "bg-violet-500/10 border border-violet-500/30" : "hover:bg-muted"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn(
                                  "w-5 h-5 rounded border flex items-center justify-center shrink-0",
                                  isSelected ? "bg-violet-500 border-violet-500" : "border-muted-foreground"
                                )}>
                                  {isSelected && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <span className="truncate font-medium">{product.product_name}</span>
                              </div>
                              <span className="text-sm text-muted-foreground shrink-0 ml-2">
                                {formatCurrency(product.base_price)}/lb
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}

                  {selectedProducts.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedProducts([])}
                      >
                        Clear all
                      </Button>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Security Section - Collapsible */}
            <Collapsible open={securityOpen} onOpenChange={setSecurityOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Security & Expiration</span>
                  </div>
                  {securityOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="space-y-4">
                  {/* Expiration */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Never Expires</Label>
                      <p className="text-xs text-muted-foreground">Menu stays active indefinitely</p>
                    </div>
                    <Switch
                      checked={neverExpires}
                      onCheckedChange={setNeverExpires}
                    />
                  </div>

                  {!neverExpires && (
                    <div className="space-y-2">
                      <Label>Expires in (days)</Label>
                      <Input
                        type="number"
                        value={expirationDays}
                        onChange={(e) => setExpirationDays(e.target.value)}
                        min="1"
                        max="365"
                      />
                    </div>
                  )}

                  {/* Geofencing */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Location</Label>
                      <p className="text-xs text-muted-foreground">Only allow access from specific area</p>
                    </div>
                    <Switch
                      checked={requireGeofence}
                      onCheckedChange={setRequireGeofence}
                    />
                  </div>

                  {/* View Limit */}
                  <div className="space-y-2">
                    <Label>Max Views (optional)</Label>
                    <Input
                      type="number"
                      placeholder="Unlimited"
                      value={maxViews || ''}
                      onChange={(e) => setMaxViews(e.target.value ? parseInt(e.target.value) : null)}
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground">
                      Burn menu after this many views
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMenu.isPending || !name.trim() || selectedProducts.length === 0}
            className="bg-gradient-to-r from-violet-600 to-indigo-600"
          >
            {createMenu.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Create Menu
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickCreateMenu;

