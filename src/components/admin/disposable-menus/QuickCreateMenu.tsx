/**
 * Quick Create Menu - Single-page form with collapsible sections
 * Faster than the wizard for power users
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { 
  ChevronDown, ChevronUp, Loader2, Check, Package, Users, 
  Shield, Calendar, Copy, ExternalLink, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface QuickCreateMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickCreateMenu({ open, onOpenChange }: QuickCreateMenuProps) {
  const { tenant } = useTenantAdminAuth();
  const createMenu = useCreateDisposableMenu();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [neverExpires, setNeverExpires] = useState(true);
  const [expirationDays, setExpirationDays] = useState('30');
  const [requireGeofence, setRequireGeofence] = useState(false);
  const [maxViews, setMaxViews] = useState<number | null>(null);

  // Section open states
  const [productsOpen, setProductsOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  // Generate access code
  const generateAccessCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };
  const [accessCode] = useState(generateAccessCode());

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['menu-products', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('wholesale_inventory')
        .select('id, product_name, base_price, quantity_lbs, category')
        .eq('tenant_id', tenant.id)
        .order('product_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id && open,
  });

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const query = productSearch.toLowerCase();
    return products.filter((p: any) => 
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
        },
      });

      // Reset and close
      setName('');
      setDescription('');
      setSelectedProducts([]);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
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
                        filteredProducts.map((product: any) => {
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

