// @ts-nocheck
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useWholesaleInventory } from '@/hooks/useWholesaleData';
import { useCreateDisposableMenu } from '@/hooks/useDisposableMenus';
import { useBulkGenerateImages } from '@/hooks/useProductImages';
import { Loader2, ChevronRight, ChevronLeft, Eye, Shield, Bell, Palette, CheckCircle2, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MenuAccessDetails } from './MenuAccessDetails';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

interface CreateMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  { id: 1, name: 'Basic Info', icon: Eye },
  { id: 2, name: 'Products', icon: CheckCircle2 },
  { id: 3, name: 'Access', icon: Shield },
  { id: 4, name: 'Security', icon: Shield },
  { id: 5, name: 'Notifications', icon: Bell },
  { id: 6, name: 'Appearance', icon: Palette },
];

export const CreateMenuDialog = ({ open, onOpenChange }: CreateMenuDialogProps) => {
  const { tenant } = useTenantAdminAuth();
  const { canCreate, getCurrent, getLimit } = useTenantLimits();
  const [currentStep, setCurrentStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [minOrder, setMinOrder] = useState('5');
  const [maxOrder, setMaxOrder] = useState('50');
  
  // Step 3: Access Control
  const [accessType, setAccessType] = useState<'invite_only' | 'shared' | 'hybrid'>('invite_only');
  const [requireAccessCode, setRequireAccessCode] = useState(true);
  // Generate 8-character alphanumeric code (matches backend)
  const generateAccessCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const [accessCode, setAccessCode] = useState(generateAccessCode());
  
  // Step 4: Security Options
  const [requireGeofence, setRequireGeofence] = useState(false);
  const [geofenceRadius, setGeofenceRadius] = useState('25');
  const [geofenceLocation, setGeofenceLocation] = useState('New York City');
  const [timeRestrictions, setTimeRestrictions] = useState(false);
  const [allowedHoursStart, setAllowedHoursStart] = useState('9');
  const [allowedHoursEnd, setAllowedHoursEnd] = useState('21');
  const [viewLimit, setViewLimit] = useState<string>('unlimited');
  const [screenshotProtection, setScreenshotProtection] = useState(true);
  const [screenshotWatermark, setScreenshotWatermark] = useState(true);
  const [deviceLocking, setDeviceLocking] = useState(false);
  const [autoBurnHours, setAutoBurnHours] = useState<string>('never');
  
  // Step 5: Notifications
  const [notifyOnSuspiciousIp, setNotifyOnSuspiciousIp] = useState(true);
  const [notifyOnFailedCode, setNotifyOnFailedCode] = useState(true);
  const [notifyOnHighViews, setNotifyOnHighViews] = useState(true);
  const [notifyOnShareAttempt, setNotifyOnShareAttempt] = useState(true);
  const [notifyOnGeofenceViolation, setNotifyOnGeofenceViolation] = useState(true);
  
  // Step 6: Appearance
  const [appearanceStyle, setAppearanceStyle] = useState<'professional' | 'minimal' | 'anonymous'>('professional');
  const [showProductImages, setShowProductImages] = useState(true);
  const [showAvailability, setShowAvailability] = useState(true);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  
  // Created menu details for display
  const [createdMenuDetails, setCreatedMenuDetails] = useState<{
    accessCode: string;
    shareableUrl: string;
    menuName: string;
  } | null>(null);

  const { data: inventory } = useWholesaleInventory(tenant?.id);
  const createMenu = useCreateDisposableMenu();
  const bulkGenerateImages = useBulkGenerateImages();

  const progress = (currentStep / STEPS.length) * 100;

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleNext = () => {
    if (currentStep === 1 && !name.trim()) {
      toast.error("Please enter a menu name");
      return;
    }
    if (currentStep === 2 && selectedProducts.length === 0) {
      toast.error("Please select at least one product");
      return;
    }
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleCreate = async () => {
    if (!name || selectedProducts.length === 0) return;

    // Check menu limit before creating
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
      const result = await createMenu.mutateAsync({
        name,
        description,
        product_ids: selectedProducts,
        min_order_quantity: parseFloat(minOrder),
        max_order_quantity: parseFloat(maxOrder),
        security_settings: {
          access_type: accessType,
          require_access_code: requireAccessCode,
          access_code: requireAccessCode ? accessCode : null,
          require_geofence: requireGeofence,
          geofence_radius: requireGeofence ? parseFloat(geofenceRadius) : null,
          geofence_location: requireGeofence ? geofenceLocation : null,
        time_restrictions: timeRestrictions,
        allowed_hours: timeRestrictions ? {
          start: parseInt(allowedHoursStart),
          end: parseInt(allowedHoursEnd),
        } : null,
        view_limit: viewLimit !== 'unlimited' ? parseInt(viewLimit) : null,
        screenshot_protection: { enabled: screenshotProtection, watermark: screenshotWatermark },
        device_locking: { enabled: deviceLocking },
        auto_burn_hours: autoBurnHours !== 'never' ? parseInt(autoBurnHours) : null,
        notification_settings: {
          suspicious_ip: notifyOnSuspiciousIp,
          failed_code: notifyOnFailedCode,
          high_views: notifyOnHighViews,
          share_attempt: notifyOnShareAttempt,
          geofence_violation: notifyOnGeofenceViolation,
        },
        appearance_style: appearanceStyle,
        show_product_images: showProductImages,
        show_availability: showAvailability,
        show_contact_info: showContactInfo,
        custom_message: customMessage,
      }
    });
    
    // Show access details if available
    if (result.access_code && result.shareable_url) {
      setCreatedMenuDetails({
        accessCode: result.access_code,
        shareableUrl: result.shareable_url,
        menuName: name,
      });
    }
    
    toast.success('Menu created successfully!');

    // Reset all state
    setCurrentStep(1);
    setName('');
    setDescription('');
    setSelectedProducts([]);
    setAccessType('invite_only');
    setRequireAccessCode(true);
    setAccessCode(generateAccessCode());
    onOpenChange(false);
    } catch (error) {
      logger.error('Error creating menu', error, { component: 'CreateMenuDialog' });
      toast.error('Failed to create menu');
    }
  };

  const generateNewCode = () => {
    setAccessCode(generateAccessCode());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Disposable Menu</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-1 ${
                  currentStep === step.id ? 'text-primary font-medium' : ''
                } ${currentStep > step.id ? 'text-green-600' : ''}`}
              >
                <step.icon className="h-3 w-3" />
                <span className="hidden sm:inline">{step.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px] py-4">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="space-y-2">
                <Label htmlFor="menuName">Menu Name (Internal Only)</Label>
                <Input
                  id="menuName"
                  placeholder="VIP Wholesale Clients"
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
                  placeholder="Premium clients, bulk orders only"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 2: Products */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Select Products</h3>
                {inventory && inventory.filter((p: { image_url?: string | null; images?: string[] | null }) => !(p.image_url || p.images?.[0])).length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        logger.debug('Generate images button clicked', { component: 'CreateMenuDialog' });
                        interface InventoryProduct {
                          id: string;
                          product_name: string;
                          category?: string | null;
                          strain_type?: string | null;
                          image_url?: string | null;
                          images?: string[] | null;
                        }

                        const productsWithoutImages = (inventory as InventoryProduct[])
                          .filter((p) => !(p.image_url || p.images?.[0]))
                          .map((p) => {
                            const category = p.category?.toLowerCase() || 'flower';
                            logger.debug('Product to generate', { 
                              product: {
                                name: p.product_name, 
                                category,
                                hasCategory: !!p.category 
                              },
                              component: 'CreateMenuDialog'
                            });
                            return {
                              id: p.id,
                              name: p.product_name,
                              category: category,
                              strain_type: p.strain_type || undefined
                            };
                          });
                        
                        logger.debug(`Found ${productsWithoutImages.length} products without images`, { component: 'CreateMenuDialog' });
                        
                        if (productsWithoutImages.length === 0) {
                          toast.error('No products need images');
                          return;
                        }
                        
                        toast.info(`Generating images for ${productsWithoutImages.length} product(s)...`);
                        await bulkGenerateImages.mutateAsync(productsWithoutImages);
                      } catch (error) {
                        logger.error('Button click error', error, { component: 'CreateMenuDialog' });
                        toast.error('Failed to start image generation');
                      }
                    }}
                    disabled={bulkGenerateImages.isPending}
                  >
                    {bulkGenerateImages.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Missing Images
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="space-y-4">
                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {inventory?.map((product: { id: string; product_name: string; image_url?: string | null; images?: string[] | null }) => {
                    const imageUrl = product.image_url || product.images?.[0];
                    return (
                      <div 
                        key={product.id} 
                        className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleProduct(product.id)}
                      >
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProduct(product.id)}
                        />
                        {imageUrl && (
                          <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            <img 
                              src={imageUrl} 
                              alt={product.product_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{product.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {('quantity_lbs' in product ? product.quantity_lbs : 0) || 0} lbs • {('quantity_units' in product ? product.quantity_units : 0) || 0} units available
                          </div>
                          {!imageUrl && (
                            <Badge variant="outline" className="text-xs mt-1">No image</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedProducts.length} product(s) selected
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

          {/* Step 3: Access Control */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Access Control</h3>
              
              <div className="space-y-3">
                <Label>Access Type</Label>
                <RadioGroup value={accessType} onValueChange={(value: string) => setAccessType(value as 'invite_only' | 'shared' | 'hybrid')}>
                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="invite_only" id="invite_only" />
                    <div className="flex-1">
                      <Label htmlFor="invite_only" className="font-medium">Invite-Only (Most Secure)</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Each customer gets unique link. Track who accessed when.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="shared" id="shared" />
                    <div className="flex-1">
                      <Label htmlFor="shared" className="font-medium">Shared Link (Less Secure)</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        One link for all customers. Easier to distribute.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="hybrid" id="hybrid" />
                    <div className="flex-1">
                      <Label htmlFor="hybrid" className="font-medium">Hybrid (Balanced)</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Shared link + customer verification required.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <Label>Require Access Code</Label>
                  <p className="text-xs text-muted-foreground">8-character alphanumeric code for additional security</p>
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
                    <Input value={accessCode} readOnly />
                  </div>
                  <Button variant="outline" onClick={generateNewCode} className="mt-6">
                    Generate New
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Security Options */}
          {currentStep === 4 && (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              <h3 className="text-lg font-semibold">Security Options</h3>

              {/* Geofencing */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Geofencing</Label>
                    <p className="text-xs text-muted-foreground">Only allow access from specific location</p>
                  </div>
                  <Switch checked={requireGeofence} onCheckedChange={setRequireGeofence} />
                </div>
                {requireGeofence && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Location</Label>
                      <Input
                        value={geofenceLocation}
                        onChange={(e) => setGeofenceLocation(e.target.value)}
                        placeholder="New York City"
                      />
                    </div>
                    <div>
                      <Label>Radius (miles)</Label>
                      <Select value={geofenceRadius} onValueChange={setGeofenceRadius}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 miles</SelectItem>
                          <SelectItem value="25">25 miles</SelectItem>
                          <SelectItem value="50">50 miles</SelectItem>
                          <SelectItem value="100">100 miles</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Time Restrictions */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Time-Based Access</Label>
                    <p className="text-xs text-muted-foreground">Limit access to specific hours</p>
                  </div>
                  <Switch checked={timeRestrictions} onCheckedChange={setTimeRestrictions} />
                </div>
                {timeRestrictions && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Start Hour</Label>
                      <Select value={allowedHoursStart} onValueChange={setAllowedHoursStart}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>End Hour</Label>
                      <Select value={allowedHoursEnd} onValueChange={setAllowedHoursEnd}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* View Limit */}
              <div className="border rounded-lg p-4 space-y-3">
                <Label>View Limit Per Customer</Label>
                <Select value={viewLimit} onValueChange={setViewLimit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                    <SelectItem value="3">3 views per week</SelectItem>
                    <SelectItem value="5">5 views per week</SelectItem>
                    <SelectItem value="10">10 views per week</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Screenshot Protection */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Screenshot Protection</Label>
                    <p className="text-xs text-muted-foreground">Detect and log screenshot attempts</p>
                  </div>
                  <Switch checked={screenshotProtection} onCheckedChange={setScreenshotProtection} />
                </div>
                {screenshotProtection && (
                  <div className="flex items-center justify-between pl-4">
                    <Label className="font-normal">Watermark with Customer ID</Label>
                    <Switch checked={screenshotWatermark} onCheckedChange={setScreenshotWatermark} />
                  </div>
                )}
              </div>

              {/* Device Locking */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Device Fingerprinting</Label>
                    <p className="text-xs text-muted-foreground">Lock to first device accessed</p>
                  </div>
                  <Switch checked={deviceLocking} onCheckedChange={setDeviceLocking} />
                </div>
              </div>

              {/* Auto-Burn */}
              <div className="border rounded-lg p-4">
                <Label>Auto-Burn After</Label>
                <Select value={autoBurnHours} onValueChange={setAutoBurnHours}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 5: Notifications */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Alert Notifications</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <Label>Suspicious IP Access</Label>
                    <p className="text-xs text-muted-foreground">Unknown IP tries to access menu</p>
                  </div>
                  <Switch checked={notifyOnSuspiciousIp} onCheckedChange={setNotifyOnSuspiciousIp} />
                </div>

                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <Label>Failed Access Codes</Label>
                    <p className="text-xs text-muted-foreground">Access code fails 3+ times</p>
                  </div>
                  <Switch checked={notifyOnFailedCode} onCheckedChange={setNotifyOnFailedCode} />
                </div>

                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <Label>High View Count</Label>
                    <p className="text-xs text-muted-foreground">Menu viewed 50+ times in one day</p>
                  </div>
                  <Switch checked={notifyOnHighViews} onCheckedChange={setNotifyOnHighViews} />
                </div>

                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <Label>Link Sharing Attempt</Label>
                    <p className="text-xs text-muted-foreground">Customer tries to share invite link</p>
                  </div>
                  <Switch checked={notifyOnShareAttempt} onCheckedChange={setNotifyOnShareAttempt} />
                </div>

                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <Label>Geofence Violations</Label>
                    <p className="text-xs text-muted-foreground">Access attempted outside allowed area</p>
                  </div>
                  <Switch checked={notifyOnGeofenceViolation} onCheckedChange={setNotifyOnGeofenceViolation} />
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Appearance */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Menu Appearance</h3>

              <div className="space-y-3">
                <Label>Menu Style</Label>
                <RadioGroup value={appearanceStyle} onValueChange={(value) => {
                  if (value === 'professional' || value === 'minimal' || value === 'anonymous') {
                    setAppearanceStyle(value);
                  }
                }}>
                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="professional" id="professional" />
                    <div className="flex-1">
                      <Label htmlFor="professional" className="font-medium">Professional</Label>
                      <p className="text-xs text-muted-foreground">Looks like catalog with images</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="minimal" id="minimal" />
                    <div className="flex-1">
                      <Label htmlFor="minimal" className="font-medium">Minimal</Label>
                      <p className="text-xs text-muted-foreground">Text-only, clean design</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="anonymous" id="anonymous" />
                    <div className="flex-1">
                      <Label htmlFor="anonymous" className="font-medium">Anonymous</Label>
                      <p className="text-xs text-muted-foreground">No branding, generic</p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <Label>Display Options</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-normal">Show product images</Label>
                    <Switch checked={showProductImages} onCheckedChange={setShowProductImages} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="font-normal">Show availability</Label>
                    <Switch checked={showAvailability} onCheckedChange={setShowAvailability} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="font-normal">Show contact info</Label>
                    <Switch checked={showContactInfo} onCheckedChange={setShowContactInfo} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Custom Message (shown at top)</Label>
                <Textarea
                  placeholder="Premium wholesale only. Serious inquiries."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Summary */}
              <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
                <h4 className="font-semibold">Menu Summary</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Name:</strong> {name}</p>
                  <p><strong>Products:</strong> {selectedProducts.length} selected</p>
                  <p><strong>Access:</strong> {accessType.replace('_', ' ')}</p>
                  <p>
                    <strong>Security:</strong>{' '}
                    {[
                      requireAccessCode && 'Access Code',
                      requireGeofence && 'Geofencing',
                      timeRestrictions && 'Time Restrictions',
                      screenshotProtection && 'Screenshot Protection',
                      deviceLocking && 'Device Locking',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Basic'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
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

      <MenuAccessDetails
        open={createdMenuDetails !== null}
        onOpenChange={(open) => {
          if (!open) setCreatedMenuDetails(null);
        }}
        accessCode={createdMenuDetails?.accessCode || ""}
        shareableUrl={createdMenuDetails?.shareableUrl || ""}
        menuName={createdMenuDetails?.menuName || ""}
      />
    </Dialog>
  );
};