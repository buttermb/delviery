import { useState, useMemo } from 'react';
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
import { useProductsForMenu } from '@/hooks/useProductsForMenu';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { MenuTemplates, type MenuTemplate } from '@/components/admin/disposable-menus/MenuTemplates';
import { Eye, CheckCircle2, Shield, Calendar, Lock, Search, X, Loader2, Sparkles, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MenuCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { id: 1, name: 'Template', icon: Sparkles },
  { id: 2, name: 'Details', icon: Eye },
  { id: 3, name: 'Products', icon: CheckCircle2 },
  { id: 4, name: 'Settings', icon: Shield },
];

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

  const { data: inventory, isLoading: inventoryLoading } = useProductsForMenu(tenant?.id);
  const createMenu = useCreateDisposableMenu();

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

  // Calculate progress - account for forum menus skipping step 3
  const totalSteps = selectedTemplate?.menuType === 'forum' ? STEPS.length - 1 : STEPS.length;
  const adjustedStep = selectedTemplate?.menuType === 'forum' && currentStep > 3 ? currentStep - 1 : currentStep;
  const progress = (adjustedStep / totalSteps) * 100;

  const handleTemplateSelect = (template: MenuTemplate) => {
    setSelectedTemplate(template);
    // Auto-populate settings based on template
    const days = template.expirationDays;
    const daysStr = typeof days === 'string' && days === 'unlimited' ? 'unlimited' : String(days);
    setExpirationDays(daysStr);
    setBurnAfterRead(template.burnAfterRead);
    setMaxViews(template.maxViews === 'unlimited' ? 'unlimited' : String(template.maxViews));
    setAccessType(template.accessType);
    setRequireAccessCode(template.requireAccessCode);
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
    // Skip product validation for forum menus
    if (currentStep === 3 && selectedTemplate?.menuType !== 'forum' && selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (currentStep < STEPS.length) {
      // Skip product step for forum menus
      if (currentStep === 2 && selectedTemplate?.menuType === 'forum') {
        setCurrentStep(4); // Jump directly to settings
      } else {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      // Skip product step when going back from settings for forum menus
      if (currentStep === 4 && selectedTemplate?.menuType === 'forum') {
        setCurrentStep(2); // Go back to details
      } else {
        setCurrentStep(prev => prev - 1);
      }
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleCreate = async () => {
    const isForumMenu = selectedTemplate?.menuType === 'forum';
    
    // Validate based on menu type
    if (!name) return;
    if (!isForumMenu && selectedProducts.length === 0) {
      toast.error('Please select at least one product');
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

    try {
      const expirationDate = expirationDays !== 'unlimited'
        ? new Date(Date.now() + parseInt(expirationDays) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await createMenu.mutateAsync({
        tenant_id: tenant?.id || '',
        name,
        description: isForumMenu 
          ? (description || 'Community Forum Access Menu')
          : description,
        product_ids: isForumMenu ? [] : selectedProducts, // Empty for forum menus
        // Don't pass min/max order for forum menus (they're optional and must be positive if provided)
        min_order_quantity: isForumMenu ? undefined : parseFloat(minOrder),
        max_order_quantity: isForumMenu ? undefined : parseFloat(maxOrder),
        access_code: requireAccessCode ? accessCode : generateAccessCode(),
        expiration_date: expirationDate || undefined,
        never_expires: !expirationDate,
        security_settings: {
          access_type: accessType,
          require_access_code: requireAccessCode,
          password_protection: requirePassword ? password : undefined,
          burn_after_read: burnAfterRead,
          max_views: maxViews !== 'unlimited' ? parseInt(maxViews) : undefined,
          menu_type: isForumMenu ? 'forum' : 'product', // Store menu type
          forum_url: isForumMenu ? '/community' : undefined, // Store forum URL
        },
      });

      toast.success('Menu Created', {
        description: isForumMenu 
          ? 'Forum menu created! Customers will be redirected to the community forum.'
          : 'Your disposable menu has been created successfully',
      });
      onOpenChange(false);
      // Reset form
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
    } catch (error: unknown) {
      toast.error('Failed to create menu', {
        description: error instanceof Error ? error.message : 'An error occurred'
      });
    }
  };

  const generateNewCode = () => {
    setAccessCode(generateAccessCode());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Menu</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step) => {
              // Hide Products step for forum menus
              if (step.id === 3 && selectedTemplate?.menuType === 'forum') {
                return null;
              }
              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-center gap-1',
                    currentStep === step.id && 'text-primary font-medium',
                    currentStep > step.id && 'text-green-600'
                  )}
                >
                  <step.icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{step.name}</span>
                </div>
              );
            })}
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
          {currentStep === 3 && selectedTemplate?.menuType !== 'forum' && (
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
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxOrder">Max Order (lbs)</Label>
                  <Input
                    id="maxOrder"
                    type="number"
                    value={maxOrder}
                    onChange={(e) => setMaxOrder(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Forum Menu Info (Only for Forum Menus) */}
          {currentStep === 3 && selectedTemplate?.menuType === 'forum' && (
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

          {/* Step 4: Settings */}
          {currentStep === 4 && (
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
                    <SelectValue />
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
                    <SelectValue />
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
          {currentStep < STEPS.length ? (
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

