import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProductsForMenu } from '@/hooks/useProductsForMenu';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCreditGatedAction } from '@/hooks/useCredits';
import { MenuTemplates, type MenuTemplate } from '@/components/admin/disposable-menus/MenuTemplates';
import {
  Eye, CheckCircle2, Shield, Search, X, Loader2, Sparkles,
  MessageSquare, DollarSign, MapPin, Users, Palette, Percent, Plus, Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MenuCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface InventoryProduct {
  id: string;
  name: string;
  price: number;
  sku?: string;
  description?: string;
  image_url?: string;
  category?: string;
  stock_quantity?: number;
}

interface GeofenceConfig {
  lat: string;
  lng: string;
  radiusMiles: string;
}

const STEPS = [
  { id: 1, name: 'Template', icon: Sparkles },
  { id: 2, name: 'Details', icon: Eye },
  { id: 3, name: 'Products', icon: CheckCircle2 },
  { id: 4, name: 'Advanced', icon: Settings2 },
  { id: 5, name: 'Settings', icon: Shield },
];

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validatePhone = (phone: string): boolean => {
  return /^\+?[\d\s\-()]{10,}$/.test(phone);
};

export const MenuCreationWizard = ({ open, onOpenChange }: MenuCreationWizardProps) => {
  const { tenant } = useTenantAdminAuth();
  const { canCreate, getCurrent, getLimit } = useTenantLimits();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<MenuTemplate | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [minOrder, setMinOrder] = useState('5');
  const [maxOrder, setMaxOrder] = useState('50');
  const [expirationDays, setExpirationDays] = useState('30');
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [maxViews, setMaxViews] = useState<string>('unlimited');
  const [requirePassword, setRequirePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [accessType, setAccessType] = useState<'invite_only' | 'shared' | 'hybrid'>('invite_only');
  const [requireAccessCode, setRequireAccessCode] = useState(true);

  // Advanced options state
  const [customPrices, setCustomPrices] = useState<Record<string, string>>({});
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState('10');
  const [geofencingEnabled, setGeofencingEnabled] = useState(false);
  const [geofence, setGeofence] = useState<GeofenceConfig>({ lat: '', lng: '', radiusMiles: '5' });
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelistedEmails, setWhitelistedEmails] = useState<string[]>([]);
  const [whitelistedPhones, setWhitelistedPhones] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [showBranding, setShowBranding] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const [headerImage, setHeaderImage] = useState('');
  const [advancedTab, setAdvancedTab] = useState('pricing');

  const { data: inventory, isLoading: inventoryLoading } = useProductsForMenu(tenant?.id);
  const createMenu = useCreateDisposableMenu();
  const { execute: executeWithCredits } = useCreditGatedAction();

  // Generate 8-character alphanumeric code
  const generateAccessCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const [accessCode, setAccessCode] = useState(generateAccessCode());

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!inventory) return [];
    if (!searchQuery.trim()) return inventory;

    const query = searchQuery.toLowerCase();
    return (inventory as InventoryProduct[]).filter((p) =>
      p.name?.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query)
    );
  }, [inventory, searchQuery]);

  // Get product by ID helper
  const getProductById = useCallback((id: string): InventoryProduct | undefined => {
    return (inventory as InventoryProduct[] | undefined)?.find(p => p.id === id);
  }, [inventory]);

  // Calculate effective price for a product (custom price or discounted price)
  const getEffectivePrice = useCallback((product: InventoryProduct): number => {
    const customPrice = customPrices[product.id];
    if (customPrice && parseFloat(customPrice) > 0) {
      return parseFloat(customPrice);
    }
    if (applyDiscount && discountPercent) {
      const discount = parseFloat(discountPercent);
      if (discount > 0 && discount <= 100) {
        return product.price * (1 - discount / 100);
      }
    }
    return product.price;
  }, [customPrices, applyDiscount, discountPercent]);

  // Determine which steps to show
  const isForumMenu = selectedTemplate?.menuType === 'forum';
  const visibleSteps = useMemo(() => {
    if (isForumMenu) {
      // Forum menus skip Products and Advanced
      return STEPS.filter(s => s.id !== 3 && s.id !== 4);
    }
    return STEPS;
  }, [isForumMenu]);

  // Calculate progress
  const stepIndex = visibleSteps.findIndex(s => s.id === currentStep);
  const progress = ((stepIndex + 1) / visibleSteps.length) * 100;

  const handleTemplateSelect = (template: MenuTemplate) => {
    setSelectedTemplate(template);
    const days = template.expirationDays;
    const daysStr = typeof days === 'string' && days === 'unlimited' ? 'unlimited' : String(days);
    setExpirationDays(daysStr);
    setBurnAfterRead(template.burnAfterRead);
    setMaxViews(template.maxViews === 'unlimited' ? 'unlimited' : String(template.maxViews));
    setAccessType(template.accessType);
    setRequireAccessCode(template.requireAccessCode);
    // Apply template security settings
    if (template.security_settings.require_geofence) {
      setGeofencingEnabled(true);
    }
  };

  const getNextStep = (current: number): number => {
    const currentIdx = visibleSteps.findIndex(s => s.id === current);
    if (currentIdx < visibleSteps.length - 1) {
      return visibleSteps[currentIdx + 1].id;
    }
    return current;
  };

  const getPrevStep = (current: number): number => {
    const currentIdx = visibleSteps.findIndex(s => s.id === current);
    if (currentIdx > 0) {
      return visibleSteps[currentIdx - 1].id;
    }
    return current;
  };

  const validateAdvancedStep = (): boolean => {
    // Validate custom prices
    for (const [productId, priceStr] of Object.entries(customPrices)) {
      if (priceStr.trim() !== '') {
        const price = parseFloat(priceStr);
        if (isNaN(price) || price < 0) {
          const product = getProductById(productId);
          toast.error(`Invalid price for ${product?.name || 'product'}`);
          return false;
        }
      }
    }

    // Validate discount
    if (applyDiscount) {
      const discount = parseFloat(discountPercent);
      if (isNaN(discount) || discount <= 0 || discount > 100) {
        toast.error('Discount must be between 1% and 100%');
        return false;
      }
    }

    // Validate geofence
    if (geofencingEnabled) {
      const lat = parseFloat(geofence.lat);
      const lng = parseFloat(geofence.lng);
      const radius = parseFloat(geofence.radiusMiles);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        toast.error('Latitude must be between -90 and 90');
        return false;
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        toast.error('Longitude must be between -180 and 180');
        return false;
      }
      if (isNaN(radius) || radius <= 0 || radius > 100) {
        toast.error('Radius must be between 0.1 and 100 miles');
        return false;
      }
    }

    // Validate whitelist entries
    if (whitelistEnabled) {
      for (const email of whitelistedEmails) {
        if (!validateEmail(email)) {
          toast.error(`Invalid email: ${email}`);
          return false;
        }
      }
      for (const phone of whitelistedPhones) {
        if (!validatePhone(phone)) {
          toast.error(`Invalid phone: ${phone}`);
          return false;
        }
      }
    }

    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedTemplate) {
      toast.error('Please select a template');
      return;
    }
    if (currentStep === 2 && !name.trim()) {
      toast.error('Menu name is required');
      return;
    }
    if (currentStep === 3 && !isForumMenu && selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (currentStep === 4 && !validateAdvancedStep()) {
      return;
    }

    const nextStep = getNextStep(currentStep);
    if (nextStep !== currentStep) {
      setCurrentStep(nextStep);
    }
  };

  const handleBack = () => {
    const prevStep = getPrevStep(currentStep);
    if (prevStep !== currentStep) {
      setCurrentStep(prevStep);
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSelection = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];

      // Remove custom price for deselected products
      if (!newSelection.includes(productId)) {
        setCustomPrices(prices => {
          const updated = { ...prices };
          delete updated[productId];
          return updated;
        });
      }

      return newSelection;
    });
  };

  const handleAddEmail = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    if (!validateEmail(trimmed)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (whitelistedEmails.includes(trimmed)) {
      toast.error('Email already added');
      return;
    }
    setWhitelistedEmails(prev => [...prev, trimmed]);
    setEmailInput('');
  };

  const handleAddPhone = () => {
    const trimmed = phoneInput.trim();
    if (!trimmed) return;
    if (!validatePhone(trimmed)) {
      toast.error('Please enter a valid phone number (10+ digits)');
      return;
    }
    if (whitelistedPhones.includes(trimmed)) {
      toast.error('Phone number already added');
      return;
    }
    setWhitelistedPhones(prev => [...prev, trimmed]);
    setPhoneInput('');
  };

  const handleRemoveEmail = (email: string) => {
    setWhitelistedEmails(prev => prev.filter(e => e !== email));
  };

  const handleRemovePhone = (phone: string) => {
    setWhitelistedPhones(prev => prev.filter(p => p !== phone));
  };

  const resetForm = () => {
    setCurrentStep(1);
    setSelectedTemplate(null);
    setName('');
    setDescription('');
    setSelectedProducts([]);
    setSearchQuery('');
    setMinOrder('5');
    setMaxOrder('50');
    setExpirationDays('30');
    setBurnAfterRead(false);
    setMaxViews('unlimited');
    setRequirePassword(false);
    setPassword('');
    setAccessCode(generateAccessCode());
    setCustomPrices({});
    setApplyDiscount(false);
    setDiscountPercent('10');
    setGeofencingEnabled(false);
    setGeofence({ lat: '', lng: '', radiusMiles: '5' });
    setWhitelistEnabled(false);
    setWhitelistedEmails([]);
    setWhitelistedPhones([]);
    setEmailInput('');
    setPhoneInput('');
    setShowBranding(true);
    setCustomMessage('');
    setHeaderImage('');
    setAdvancedTab('pricing');
  };

  const handleCreate = async () => {
    // Validate based on menu type
    if (!name) return;
    if (!isForumMenu && selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    // Validate password if required
    if (requirePassword && !password.trim()) {
      toast.error('Password is required when password protection is enabled');
      return;
    }

    // Check menu limit
    if (!canCreate('menus')) {
      const current = getCurrent('menus');
      const limit = getLimit('menus');
      toast.error('Menu Limit Reached', {
        description: limit === Infinity
          ? 'Unable to create menu. Please contact support.'
          : `You've reached your menu limit (${current}/${limit === Infinity ? '∞' : limit}). Upgrade to Professional for unlimited menus.`,
      });
      return;
    }

    const expirationDate = expirationDays !== 'unlimited'
      ? new Date(Date.now() + parseInt(expirationDays) * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Build custom prices map (only non-empty values)
    const finalCustomPrices: Record<string, number> = {};
    for (const [productId, priceStr] of Object.entries(customPrices)) {
      if (priceStr.trim() !== '' && selectedProducts.includes(productId)) {
        const price = parseFloat(priceStr);
        if (!isNaN(price) && price > 0) {
          finalCustomPrices[productId] = price;
        }
      }
    }

    // Apply discount to products without custom prices
    if (applyDiscount && parseFloat(discountPercent) > 0) {
      const discount = parseFloat(discountPercent);
      for (const productId of selectedProducts) {
        if (!finalCustomPrices[productId]) {
          const product = getProductById(productId);
          if (product) {
            finalCustomPrices[productId] = parseFloat((product.price * (1 - discount / 100)).toFixed(2));
          }
        }
      }
    }

    await executeWithCredits('menu_create', async () => {
      await createMenu.mutateAsync({
        tenant_id: tenant?.id || '',
        name,
        description: isForumMenu
          ? (description || 'Community Forum Access Menu')
          : description,
        product_ids: isForumMenu ? [] : selectedProducts,
        min_order_quantity: isForumMenu ? undefined : parseFloat(minOrder),
        max_order_quantity: isForumMenu ? undefined : parseFloat(maxOrder),
        custom_prices: Object.keys(finalCustomPrices).length > 0 ? finalCustomPrices : undefined,
        access_code: requireAccessCode ? accessCode : generateAccessCode(),
        expiration_date: expirationDate || undefined,
        never_expires: !expirationDate,
        security_settings: {
          access_type: accessType,
          require_access_code: requireAccessCode,
          password_protection: requirePassword ? password : undefined,
          burn_after_read: burnAfterRead,
          max_views: maxViews !== 'unlimited' ? parseInt(maxViews) : undefined,
          menu_type: isForumMenu ? 'forum' : 'product',
          forum_url: isForumMenu ? '/community' : undefined,
          geofencing_enabled: geofencingEnabled,
          geofence: geofencingEnabled ? {
            lat: parseFloat(geofence.lat),
            lng: parseFloat(geofence.lng),
            radius_miles: parseFloat(geofence.radiusMiles),
          } : undefined,
          whitelist_enabled: whitelistEnabled,
          whitelisted_emails: whitelistEnabled ? whitelistedEmails : undefined,
          whitelisted_phones: whitelistEnabled ? whitelistedPhones : undefined,
        },
        appearance_settings: {
          show_branding: showBranding,
          custom_message: customMessage || undefined,
          header_image: headerImage || undefined,
          discount_applied: applyDiscount ? parseFloat(discountPercent) : undefined,
        },
      });

      onOpenChange(false);
      resetForm();
    });
  };

  const generateNewCode = () => {
    setAccessCode(generateAccessCode());
  };

  const isLastStep = currentStep === visibleSteps[visibleSteps.length - 1]?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Menu</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {visibleSteps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-1',
                  currentStep === step.id && 'text-primary font-medium',
                  visibleSteps.findIndex(s => s.id === currentStep) > visibleSteps.findIndex(s => s.id === step.id) && 'text-green-600'
                )}
              >
                <step.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{step.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px] py-4">
          {/* Step 1: Template Selection */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Choose a Template</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select a template to quickly configure your menu settings, or choose Custom to start from scratch.
              </p>
              <MenuTemplates
                onSelectTemplate={handleTemplateSelect}
                selectedTemplateId={selectedTemplate?.id}
              />
            </div>
          )}

          {/* Step 2: Details */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Menu Details</h3>
              <div className="space-y-2">
                <Label htmlFor="menuName">Menu Name *</Label>
                <Input
                  id="menuName"
                  placeholder="VIP Wholesale Clients - Q1 2025"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This name is only visible to you, not to customers
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="menuDescription">Description (Optional)</Label>
                <Textarea
                  id="menuDescription"
                  placeholder="Premium products for exclusive clients..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 3: Products (Skip for Forum Menus) */}
          {currentStep === 3 && !isForumMenu && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Select Products</h3>
                <Badge variant="secondary">
                  {selectedProducts.length} selected
                </Badge>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by name, strain, category, or brand..."
                  aria-label="Search products"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Product List */}
              {inventoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                  <div className="grid gap-2 p-4">
                    {filteredProducts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {searchQuery ? 'No products found' : 'No products available'}
                      </div>
                    ) : (
                      filteredProducts.map((product: InventoryProduct) => {
                        const isSelected = selectedProducts.includes(product.id);

                        return (
                          <div
                            key={product.id}
                            className={cn(
                              'flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                              isSelected && 'bg-primary/5 border-primary'
                            )}
                            onClick={() => toggleProduct(product.id)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleProduct(product.id)}
                              className="mt-1"
                            />
                            {product.image_url && (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-12 h-12 object-cover rounded"
                                loading="lazy"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                {product.sku && <Badge variant="outline">{product.sku}</Badge>}
                                {product.category && <Badge variant="outline">{product.category}</Badge>}
                                <span className="text-primary font-medium">${product.price}</span>
                                {product.stock_quantity !== undefined && (
                                  <span className="text-xs">Stock: {product.stock_quantity}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Order Limits */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="minOrder">Min Order (lbs)</Label>
                  <Input
                    id="minOrder"
                    type="number"
                    min="0"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxOrder">Max Order (lbs)</Label>
                  <Input
                    id="maxOrder"
                    type="number"
                    min="0"
                    value={maxOrder}
                    onChange={(e) => setMaxOrder(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Forum Menu Info (Only for Forum Menus) */}
          {currentStep === 3 && isForumMenu && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-6">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-6 w-6 text-green-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">Forum Menu</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This menu will redirect customers to the community forum where they can:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground mb-4">
                      <li>Browse and discuss products</li>
                      <li>Share reviews and experiences</li>
                      <li>Ask questions and get answers</li>
                      <li>Connect with other customers</li>
                    </ul>
                    <div className="rounded-md bg-primary/10 p-3">
                      <p className="text-sm font-medium">
                        Customers will be redirected to: <code className="text-xs bg-background px-2 py-1 rounded">/community</code>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Advanced Options */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Advanced Options</h3>
              <p className="text-sm text-muted-foreground">
                Configure custom pricing, location restrictions, access control, and branding.
              </p>

              <Tabs value={advancedTab} onValueChange={setAdvancedTab}>
                <TabsList className="flex w-full overflow-x-auto">
                  <TabsTrigger value="pricing" className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    <span className="hidden sm:inline">Pricing</span>
                  </TabsTrigger>
                  <TabsTrigger value="geofence" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="hidden sm:inline">Location</span>
                  </TabsTrigger>
                  <TabsTrigger value="whitelist" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span className="hidden sm:inline">Whitelist</span>
                  </TabsTrigger>
                  <TabsTrigger value="branding" className="flex items-center gap-1">
                    <Palette className="h-3 w-3" />
                    <span className="hidden sm:inline">Branding</span>
                  </TabsTrigger>
                </TabsList>

                {/* Custom Pricing Tab */}
                <TabsContent value="pricing" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Bulk Discount
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Apply discount to all products</Label>
                          <p className="text-xs text-muted-foreground">
                            Percentage off the base price (overridden by custom prices)
                          </p>
                        </div>
                        <Switch
                          checked={applyDiscount}
                          onCheckedChange={setApplyDiscount}
                        />
                      </div>
                      {applyDiscount && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={discountPercent}
                            onChange={(e) => setDiscountPercent(e.target.value)}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">% off</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Custom Per-Product Pricing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedProducts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No products selected. Go back to select products first.
                        </p>
                      ) : (
                        <div className="space-y-3 max-h-[250px] overflow-y-auto">
                          {selectedProducts.map(productId => {
                            const product = getProductById(productId);
                            if (!product) return null;
                            const effectivePrice = getEffectivePrice(product);
                            const hasCustomPrice = customPrices[productId] && customPrices[productId].trim() !== '';

                            return (
                              <div key={productId} className="flex items-center gap-3 p-2 border rounded">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{product.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Base: ${product.price.toFixed(2)}
                                    {!hasCustomPrice && applyDiscount && (
                                      <span className="text-green-600 ml-1">
                                        (-{discountPercent}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">$</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder={effectivePrice.toFixed(2)}
                                    value={customPrices[productId] || ''}
                                    onChange={(e) => setCustomPrices(prev => ({
                                      ...prev,
                                      [productId]: e.target.value,
                                    }))}
                                    className="w-24 h-8 text-sm"
                                  />
                                </div>
                                {hasCustomPrice && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-11 w-11 p-0"
                                    onClick={() => setCustomPrices(prev => {
                                      const updated = { ...prev };
                                      delete updated[productId];
                                      return updated;
                                    })}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Geofencing Tab */}
                <TabsContent value="geofence" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Geofencing
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Enable Geofencing</Label>
                          <p className="text-xs text-muted-foreground">
                            Restrict menu access to a specific geographic area
                          </p>
                        </div>
                        <Switch
                          checked={geofencingEnabled}
                          onCheckedChange={setGeofencingEnabled}
                        />
                      </div>

                      {geofencingEnabled && (
                        <div className="space-y-3 pl-1">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="geoLat" className="text-xs">Latitude</Label>
                              <Input
                                id="geoLat"
                                type="number"
                                step="0.000001"
                                min="-90"
                                max="90"
                                placeholder="34.052235"
                                value={geofence.lat}
                                onChange={(e) => setGeofence(prev => ({ ...prev, lat: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="geoLng" className="text-xs">Longitude</Label>
                              <Input
                                id="geoLng"
                                type="number"
                                step="0.000001"
                                min="-180"
                                max="180"
                                placeholder="-118.243683"
                                value={geofence.lng}
                                onChange={(e) => setGeofence(prev => ({ ...prev, lng: e.target.value }))}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="geoRadius" className="text-xs">Radius (miles)</Label>
                            <Input
                              id="geoRadius"
                              type="number"
                              min="0.1"
                              max="100"
                              step="0.1"
                              value={geofence.radiusMiles}
                              onChange={(e) => setGeofence(prev => ({ ...prev, radiusMiles: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">
                              Customers must be within this radius to access the menu
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Whitelist Tab */}
                <TabsContent value="whitelist" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Access Whitelist
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Enable Whitelist</Label>
                          <p className="text-xs text-muted-foreground">
                            Only allow specific emails or phone numbers to access
                          </p>
                        </div>
                        <Switch
                          checked={whitelistEnabled}
                          onCheckedChange={setWhitelistEnabled}
                        />
                      </div>

                      {whitelistEnabled && (
                        <div className="space-y-4">
                          {/* Email Whitelist */}
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Whitelisted Emails</Label>
                            <div className="flex gap-2">
                              <Input
                                type="email"
                                placeholder="customer@example.com"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddEmail();
                                  }
                                }}
                                className="flex-1"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleAddEmail}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            {whitelistedEmails.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {whitelistedEmails.map(email => (
                                  <Badge key={email} variant="secondary" className="flex items-center gap-1">
                                    {email}
                                    <button
                                      onClick={() => handleRemoveEmail(email)}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Phone Whitelist */}
                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Whitelisted Phone Numbers</Label>
                            <div className="flex gap-2">
                              <Input
                                type="tel"
                                placeholder="+1 (555) 123-4567"
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddPhone();
                                  }
                                }}
                                className="flex-1"
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleAddPhone}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            {whitelistedPhones.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {whitelistedPhones.map(phone => (
                                  <Badge key={phone} variant="secondary" className="flex items-center gap-1">
                                    {phone}
                                    <button
                                      onClick={() => handleRemovePhone(phone)}
                                      className="ml-1 hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Branding Tab */}
                <TabsContent value="branding" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        Menu Branding
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Show Business Branding</Label>
                          <p className="text-xs text-muted-foreground">
                            Display your business name and logo on the menu
                          </p>
                        </div>
                        <Switch
                          checked={showBranding}
                          onCheckedChange={setShowBranding}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="headerImage">Header Image URL</Label>
                        <Input
                          id="headerImage"
                          type="url"
                          placeholder="https://example.com/banner.jpg"
                          value={headerImage}
                          onChange={(e) => setHeaderImage(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Recommended size: 1200x300px. Displayed at the top of the menu.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="customMessage">Custom Welcome Message</Label>
                        <Textarea
                          id="customMessage"
                          placeholder="Welcome to our exclusive menu! Check out our latest products..."
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          rows={3}
                          maxLength={500}
                        />
                        <p className="text-xs text-muted-foreground">
                          {customMessage.length}/500 characters. Shown to customers when they open the menu.
                        </p>
                      </div>

                      {/* Preview */}
                      {(headerImage || customMessage || showBranding) && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-muted px-3 py-1.5 border-b">
                            <span className="text-xs font-medium text-muted-foreground">Preview</span>
                          </div>
                          <div className="p-4 space-y-3">
                            {headerImage && (
                              <div className="w-full h-20 bg-muted rounded overflow-hidden">
                                <img
                                  src={headerImage}
                                  alt="Header preview"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                  loading="lazy"
                                />
                              </div>
                            )}
                            {showBranding && (
                              <p className="text-sm font-semibold">
                                {tenant?.business_name || 'Your Business'}
                              </p>
                            )}
                            {customMessage && (
                              <p className="text-xs text-muted-foreground">{customMessage}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Step 5: Settings */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Menu Settings</h3>

              {/* Access Type */}
              <div className="space-y-3">
                <Label>Access Type</Label>
                <RadioGroup value={accessType} onValueChange={(value: string) => setAccessType(value as 'invite_only' | 'shared' | 'hybrid')}>
                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="invite_only" id="invite_only" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="invite_only" className="font-medium">Invite-Only (Most Secure)</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Each customer gets unique link. Track who accessed when.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="shared" id="shared" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="shared" className="font-medium">Shared Link</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        One link for all customers. Easier to distribute.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="hybrid" id="hybrid" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="hybrid" className="font-medium">Hybrid (Balanced)</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Shared link + customer verification required.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Access Code */}
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <Label>Require Access Code</Label>
                  <p className="text-xs text-muted-foreground">8-character alphanumeric code</p>
                </div>
                <Switch
                  checked={requireAccessCode}
                  onCheckedChange={setRequireAccessCode}
                />
              </div>

              {requireAccessCode && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label>Access Code</Label>
                    <Input value={accessCode} readOnly className="font-mono" />
                  </div>
                  <Button variant="outline" onClick={generateNewCode} className="mt-6">
                    Generate New
                  </Button>
                </div>
              )}

              {/* Password Protection */}
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <Label>Password Protection</Label>
                  <p className="text-xs text-muted-foreground">Require password to view menu</p>
                </div>
                <Switch
                  checked={requirePassword}
                  onCheckedChange={setRequirePassword}
                />
              </div>

              {requirePassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
              )}

              {/* Expiration */}
              <div className="space-y-2">
                <Label htmlFor="expiration">Expiration (days)</Label>
                <Select value={expirationDays} onValueChange={setExpirationDays}>
                  <SelectTrigger id="expiration">
                    <SelectValue placeholder="Select expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="unlimited">Never expire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Burn After Read */}
              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <Label>Burn After Read</Label>
                  <p className="text-xs text-muted-foreground">Menu expires after first view</p>
                </div>
                <Switch
                  checked={burnAfterRead}
                  onCheckedChange={setBurnAfterRead}
                />
              </div>

              {/* Max Views */}
              <div className="space-y-2">
                <Label htmlFor="maxViews">Max Views</Label>
                <Select value={maxViews} onValueChange={setMaxViews}>
                  <SelectTrigger id="maxViews">
                    <SelectValue placeholder="Select view limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 view</SelectItem>
                    <SelectItem value="5">5 views</SelectItem>
                    <SelectItem value="10">10 views</SelectItem>
                    <SelectItem value="50">50 views</SelectItem>
                    <SelectItem value="100">100 views</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary of advanced options */}
              {(applyDiscount || geofencingEnabled || whitelistEnabled || Object.keys(customPrices).length > 0) && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Advanced Options Applied:</p>
                  <div className="flex flex-wrap gap-2">
                    {applyDiscount && (
                      <Badge variant="secondary" className="text-xs">
                        {discountPercent}% Discount
                      </Badge>
                    )}
                    {Object.keys(customPrices).filter(id => customPrices[id]?.trim()).length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {Object.keys(customPrices).filter(id => customPrices[id]?.trim()).length} Custom Prices
                      </Badge>
                    )}
                    {geofencingEnabled && (
                      <Badge variant="secondary" className="text-xs">
                        Geofenced ({geofence.radiusMiles}mi)
                      </Badge>
                    )}
                    {whitelistEnabled && (
                      <Badge variant="secondary" className="text-xs">
                        {whitelistedEmails.length + whitelistedPhones.length} Whitelisted
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            Back
          </Button>
          {!isLastStep ? (
            <Button onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={createMenu.isPending}
            >
              {createMenu.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Menu'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
