import { logger } from '@/lib/logger';
import { useState, useEffect, useMemo } from 'react';
import { sanitizeFormInput, sanitizeTextareaInput } from '@/lib/utils/sanitize';
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
import {
  Loader2, ChevronRight, ChevronLeft, Eye, Shield, Bell, Palette,
  CheckCircle2, Sparkles, Search, DollarSign, Clock, Users,
  Mail, Phone, Image, X
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { MenuAccessDetails } from './MenuAccessDetails';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useFreeTierLimits } from '@/hooks/useFreeTierLimits';

// ============================================
// Types
// ============================================

interface CreateMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface MenuGeofence {
  lat: number;
  lng: number;
  radiusMiles: number;
}

export interface MenuOptions {
  name: string;
  products: string[];
  customPrices: Record<string, number>;
  applyDiscount: boolean;
  discountPercent: number;
  expirationHours: number; // 1-168
  maxViews: number; // 1-1000
  accessCodeEnabled: boolean;
  accessCode: string; // 4-8 digits
  geofencingEnabled: boolean;
  geofence: MenuGeofence | null;
  whitelistEnabled: boolean;
  whitelistedEmails: string[];
  whitelistedPhones: string[];
  showBranding: boolean;
  customMessage: string;
  headerImage: string;
}

interface InventoryProduct {
  id: string;
  product_name: string;
  category?: string | null;
  strain_type?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  base_price?: number | null;
  quantity_lbs?: number | null;
  quantity_units?: number | null;
}

// ============================================
// QR Code Placeholder Component
// ============================================

function QRCodePlaceholder({ value, size = 128 }: { value: string; size?: number }) {
  // Basic SVG QR code placeholder - swap with qrcode.react when ready
  const gridSize = 21;
  const cellSize = size / gridSize;

  // Generate a deterministic pattern from the value string
  const cells: boolean[][] = [];
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }

  for (let row = 0; row < gridSize; row++) {
    cells[row] = [];
    for (let col = 0; col < gridSize; col++) {
      // Fixed patterns for QR finder patterns (corners)
      const isFinderPattern =
        (row < 7 && col < 7) ||
        (row < 7 && col >= gridSize - 7) ||
        (row >= gridSize - 7 && col < 7);

      if (isFinderPattern) {
        const inOuter = row < 7 && col < 7
          ? (row === 0 || row === 6 || col === 0 || col === 6)
          : row < 7 && col >= gridSize - 7
            ? (row === 0 || row === 6 || col === gridSize - 7 || col === gridSize - 1)
            : (row === gridSize - 7 || row === gridSize - 1 || col === 0 || col === 6);
        const inInner = row < 7 && col < 7
          ? (row >= 2 && row <= 4 && col >= 2 && col <= 4)
          : row < 7 && col >= gridSize - 7
            ? (row >= 2 && row <= 4 && col >= gridSize - 5 && col <= gridSize - 3)
            : (row >= gridSize - 5 && row <= gridSize - 3 && col >= 2 && col <= 4);
        cells[row][col] = inOuter || inInner;
      } else {
        // Pseudo-random for data area
        const seed = (hash + row * 37 + col * 53) & 0xFFFFFF;
        cells[row][col] = (seed % 3) !== 0;
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="border rounded">
      <rect width={size} height={size} fill="white" />
      {cells.map((row, rowIdx) =>
        row.map((filled, colIdx) =>
          filled ? (
            <rect
              key={`${rowIdx}-${colIdx}`}
              x={colIdx * cellSize}
              y={rowIdx * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          ) : null
        )
      )}
    </svg>
  );
}

// ============================================
// Constants
// ============================================

const STEPS = [
  { id: 1, name: 'Basic Info', icon: Eye },
  { id: 2, name: 'Products', icon: CheckCircle2 },
  { id: 3, name: 'Pricing', icon: DollarSign },
  { id: 4, name: 'Expiration', icon: Clock },
  { id: 5, name: 'Access', icon: Shield },
  { id: 6, name: 'Security', icon: Shield },
  { id: 7, name: 'Whitelist', icon: Users },
  { id: 8, name: 'Notifications', icon: Bell },
  { id: 9, name: 'Branding', icon: Palette },
];

// ============================================
// Component
// ============================================

export const CreateMenuDialog = ({ open, onOpenChange }: CreateMenuDialogProps) => {
  const { tenant } = useTenantAdminAuth();
  const { canCreate, getCurrent, getLimit } = useTenantLimits();
  const { checkLimit, recordAction, limitsApply } = useFreeTierLimits();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Products (with search)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [minOrder, setMinOrder] = useState('5');
  const [maxOrder, setMaxOrder] = useState('50');

  // Step 3: Custom Pricing
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(10);

  // Step 4: Expiration Settings
  const [expirationHours, setExpirationHours] = useState<number>(168);
  const [maxViews, setMaxViews] = useState<number>(100);
  const [neverExpires, setNeverExpires] = useState(false);

  // Step 5: Access Control
  const [accessType, setAccessType] = useState<'invite_only' | 'shared' | 'hybrid'>('invite_only');
  const [requireAccessCode, setRequireAccessCode] = useState(true);
  const generateAccessCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };
  const [accessCode, setAccessCode] = useState(generateAccessCode());

  // Step 6: Security Options
  const [requireGeofence, setRequireGeofence] = useState(false);
  const [geofenceLat, setGeofenceLat] = useState('40.7128');
  const [geofenceLng, setGeofenceLng] = useState('-74.0060');
  const [geofenceRadius, setGeofenceRadius] = useState('25');
  const [geofenceLocation, setGeofenceLocation] = useState('New York City');
  const [timeRestrictions, setTimeRestrictions] = useState(false);
  const [allowedHoursStart, setAllowedHoursStart] = useState('9');
  const [allowedHoursEnd, setAllowedHoursEnd] = useState('21');
  const [screenshotProtection, setScreenshotProtection] = useState(true);
  const [screenshotWatermark, setScreenshotWatermark] = useState(true);
  const [deviceLocking, setDeviceLocking] = useState(false);
  const [autoBurnHours, setAutoBurnHours] = useState<string>('never');

  // Step 7: Whitelist
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelistedEmails, setWhitelistedEmails] = useState<string[]>([]);
  const [whitelistedPhones, setWhitelistedPhones] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Step 8: Notifications
  const [notifyOnSuspiciousIp, setNotifyOnSuspiciousIp] = useState(true);
  const [notifyOnFailedCode, setNotifyOnFailedCode] = useState(true);
  const [notifyOnHighViews, setNotifyOnHighViews] = useState(true);
  const [notifyOnShareAttempt, setNotifyOnShareAttempt] = useState(true);
  const [notifyOnGeofenceViolation, setNotifyOnGeofenceViolation] = useState(true);

  // Step 9: Branding
  const [showBranding, setShowBranding] = useState(true);
  const [appearanceStyle, setAppearanceStyle] = useState<'professional' | 'minimal' | 'anonymous'>('professional');
  const [showProductImages, setShowProductImages] = useState(true);
  const [showAvailability, setShowAvailability] = useState(true);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [headerImage, setHeaderImage] = useState('');

  // Created menu details
  const [createdMenuDetails, setCreatedMenuDetails] = useState<{
    accessCode: string;
    shareableUrl: string;
    menuName: string;
  } | null>(null);

  // Reset all form state when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setName('');
      setDescription('');
      setSelectedProducts([]);
      setProductSearch('');
      setMinOrder('5');
      setMaxOrder('50');
      setCustomPrices({});
      setApplyDiscount(false);
      setDiscountPercent(10);
      setExpirationHours(168);
      setMaxViews(100);
      setNeverExpires(false);
      setAccessType('invite_only');
      setRequireAccessCode(true);
      setAccessCode(generateAccessCode());
      setRequireGeofence(false);
      setGeofenceLat('40.7128');
      setGeofenceLng('-74.0060');
      setGeofenceRadius('25');
      setGeofenceLocation('New York City');
      setTimeRestrictions(false);
      setAllowedHoursStart('9');
      setAllowedHoursEnd('21');
      setScreenshotProtection(true);
      setScreenshotWatermark(true);
      setDeviceLocking(false);
      setAutoBurnHours('never');
      setWhitelistEnabled(false);
      setWhitelistedEmails([]);
      setWhitelistedPhones([]);
      setNewEmail('');
      setNewPhone('');
      setNotifyOnSuspiciousIp(true);
      setNotifyOnFailedCode(true);
      setNotifyOnHighViews(true);
      setNotifyOnShareAttempt(true);
      setNotifyOnGeofenceViolation(true);
      setShowBranding(true);
      setAppearanceStyle('professional');
      setShowProductImages(true);
      setShowAvailability(true);
      setShowContactInfo(false);
      setCustomMessage('');
      setHeaderImage('');
    }
  // Deps: only `open` matters. All other calls are React state setters (stable)
  // and `generateAccessCode` is a component-scoped function with no external deps.
  }, [open]);

  const { data: inventory } = useWholesaleInventory(tenant?.id);
  const createMenu = useCreateDisposableMenu();
  const bulkGenerateImages = useBulkGenerateImages();

  const progress = (currentStep / STEPS.length) * 100;

  // Filtered products for search
  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    if (!productSearch.trim()) return inventory as InventoryProduct[];
    const query = productSearch.toLowerCase();
    return (inventory as InventoryProduct[]).filter(
      (p) =>
        p.product_name.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query) ||
        p.strain_type?.toLowerCase().includes(query)
    );
  }, [inventory, productSearch]);

  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = filteredInventory.map((p) => p.id);
    setSelectedProducts((prev) => {
      const combined = new Set([...prev, ...visibleIds]);
      return Array.from(combined);
    });
  };

  const deselectAll = () => {
    setSelectedProducts([]);
  };

  // Custom price helpers
  const setProductPrice = (productId: string, price: number) => {
    setCustomPrices((prev) => ({ ...prev, [productId]: price }));
  };

  const removeCustomPrice = (productId: string) => {
    setCustomPrices((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  // Whitelist helpers
  const addEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (whitelistedEmails.includes(trimmed)) {
      toast.error('Email already added');
      return;
    }
    setWhitelistedEmails((prev) => [...prev, trimmed]);
    setNewEmail('');
  };

  const removeEmail = (email: string) => {
    setWhitelistedEmails((prev) => prev.filter((e) => e !== email));
  };

  const addPhone = () => {
    const trimmed = newPhone.trim();
    if (!trimmed || trimmed.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    if (whitelistedPhones.includes(trimmed)) {
      toast.error('Phone already added');
      return;
    }
    setWhitelistedPhones((prev) => [...prev, trimmed]);
    setNewPhone('');
  };

  const removePhone = (phone: string) => {
    setWhitelistedPhones((prev) => prev.filter((p) => p !== phone));
  };

  const handleNext = () => {
    if (currentStep === 1 && !name.trim()) {
      toast.error('Please enter a menu name');
      return;
    }
    if (currentStep === 2 && selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const [showLongLoadingMessage, setShowLongLoadingMessage] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (createMenu.isPending) {
      timer = setTimeout(() => setShowLongLoadingMessage(true), 5000);
    } else {
      setShowLongLoadingMessage(false);
    }
    return () => clearTimeout(timer);
  }, [createMenu.isPending]);

  const handleCreate = async () => {
    if (!name || selectedProducts.length === 0) return;

    if (!canCreate('menus')) {
      const current = getCurrent('menus');
      const limit = getLimit('menus');
      toast.error('Menu Limit Reached', {
        description:
          limit === Infinity
            ? 'Unable to create menu. Please contact support.'
            : `You've reached your menu limit (${current}/${limit === Infinity ? '∞' : limit}). Upgrade to Professional for unlimited menus.`,
      });
      return;
    }

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
      const result = await createMenu.mutateAsync({
        tenant_id: tenant?.id ?? '',
        name: sanitizeFormInput(name, 200),
        description: sanitizeTextareaInput(description, 500),
        product_ids: selectedProducts,
        min_order_quantity: parseFloat(minOrder),
        max_order_quantity: parseFloat(maxOrder),
        access_code: requireAccessCode ? accessCode : generateAccessCode(),
        security_settings: {
          access_type: accessType,
          require_access_code: requireAccessCode,
          require_geofence: requireGeofence,
          geofence_radius: requireGeofence ? parseFloat(geofenceRadius) : null,
          geofence_location: requireGeofence ? sanitizeFormInput(geofenceLocation, 200) : null,
          geofence_lat: requireGeofence ? parseFloat(geofenceLat) : null,
          geofence_lng: requireGeofence ? parseFloat(geofenceLng) : null,
          time_restrictions: timeRestrictions,
          allowed_hours: timeRestrictions
            ? { start: parseInt(allowedHoursStart), end: parseInt(allowedHoursEnd) }
            : null,
          view_limit: maxViews > 0 && maxViews < 1000 ? maxViews : null,
          screenshot_protection: { enabled: screenshotProtection, watermark: screenshotWatermark },
          device_locking: { enabled: deviceLocking },
          auto_burn_hours: autoBurnHours !== 'never' ? parseInt(autoBurnHours) : null,
          expiration_hours: neverExpires ? null : expirationHours,
          custom_prices: Object.keys(customPrices).length > 0 ? customPrices : null,
          apply_discount: applyDiscount,
          discount_percent: applyDiscount ? discountPercent : null,
          whitelist_enabled: whitelistEnabled,
          whitelisted_emails: whitelistEnabled ? whitelistedEmails : [],
          whitelisted_phones: whitelistEnabled ? whitelistedPhones : [],
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
          show_branding: showBranding,
          custom_message: sanitizeFormInput(customMessage, 500),
          header_image: headerImage || null,
        },
      });

      if (limitsApply) {
        await recordAction('menu');
      }

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
      setCustomPrices({});
      setApplyDiscount(false);
      setDiscountPercent(10);
      setWhitelistedEmails([]);
      setWhitelistedPhones([]);
      setAccessType('invite_only');
      setRequireAccessCode(true);
      setAccessCode(generateAccessCode());
      onOpenChange(false);
    } catch (error) {
      logger.error('Error creating menu', error, { component: 'CreateMenuDialog' });
    }
  };

  const generateNewCode = () => {
    setAccessCode(generateAccessCode());
  };

  // Build the MenuOptions for summary
  const menuOptions: MenuOptions = {
    name,
    products: selectedProducts,
    customPrices,
    applyDiscount,
    discountPercent,
    expirationHours,
    maxViews,
    accessCodeEnabled: requireAccessCode,
    accessCode,
    geofencingEnabled: requireGeofence,
    geofence: requireGeofence
      ? { lat: parseFloat(geofenceLat), lng: parseFloat(geofenceLng), radiusMiles: parseFloat(geofenceRadius) }
      : null,
    whitelistEnabled,
    whitelistedEmails,
    whitelistedPhones,
    showBranding,
    customMessage,
    headerImage,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Disposable Menu</DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground overflow-x-auto">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-1 whitespace-nowrap px-0.5 ${
                  currentStep === step.id ? 'text-primary font-medium' : ''
                } ${currentStep > step.id ? 'text-green-600' : ''}`}
              >
                <step.icon className="h-3 w-3" />
                <span className="hidden lg:inline">{step.name}</span>
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

          {/* Step 2: Product Selection (multi-select with search) */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Select Products</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllVisible}>
                    Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Deselect All
                  </Button>
                  {inventory &&
                    (inventory as InventoryProduct[]).filter(
                      (p) => !(p.image_url || p.images?.[0])
                    ).length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const productsWithoutImages = (inventory as InventoryProduct[])
                              .filter((p) => !(p.image_url || p.images?.[0]))
                              .map((p) => ({
                                id: p.id,
                                name: p.product_name,
                                category: p.category?.toLowerCase() || 'flower',
                                strain_type: p.strain_type || undefined,
                              }));
                            if (productsWithoutImages.length === 0) {
                              toast.error('No products need images');
                              return;
                            }
                            toast.info(
                              `Generating images for ${productsWithoutImages.length} product(s)...`
                            );
                            await bulkGenerateImages.mutateAsync(productsWithoutImages);
                          } catch (error) {
                            logger.error('Button click error', error, {
                              component: 'CreateMenuDialog',
                            });
                            toast.error('Failed to start image generation', { description: humanizeError(error) });
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
                            Generate Images
                          </>
                        )}
                      </Button>
                    )}
                </div>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by name, category, or strain..."
                  aria-label="Search products"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
                {productSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setProductSearch('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <div className="border rounded-lg divide-y max-h-[350px] overflow-y-auto">
                  {filteredInventory.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No products match your search</p>
                    </div>
                  ) : (
                    filteredInventory.map((product) => {
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
                                loading="lazy"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="font-medium">{product.product_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {product.category && (
                                <Badge variant="outline" className="text-xs mr-2">
                                  {product.category}
                                </Badge>
                              )}
                              {String(product.quantity_lbs ?? 0)} lbs available
                              {product.base_price
                                ? ` | $${product.base_price}/lb`
                                : ''}
                            </div>
                            {!imageUrl && (
                              <Badge variant="outline" className="text-xs mt-1">
                                No image
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedProducts.length} product(s) selected
                  {productSearch && ` (showing ${filteredInventory.length} of ${(inventory as InventoryProduct[] | undefined)?.length ?? 0})`}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Step 3: Custom Pricing */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Custom Pricing</h3>
              <p className="text-sm text-muted-foreground">
                Override default prices for selected products or apply a bulk discount.
              </p>

              {/* Bulk discount */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Apply Bulk Discount</Label>
                    <p className="text-xs text-muted-foreground">
                      Apply a percentage discount to all products
                    </p>
                  </div>
                  <Switch checked={applyDiscount} onCheckedChange={setApplyDiscount} />
                </div>
                {applyDiscount && (
                  <div className="flex items-center gap-3">
                    <Label className="shrink-0">Discount %</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Math.min(50, Math.max(1, parseInt(e.target.value) || 0)))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                )}
              </div>

              {/* Per-product pricing */}
              <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                {selectedProducts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Select products first to set custom prices</p>
                  </div>
                ) : (
                  selectedProducts.map((productId) => {
                    const product = (inventory as InventoryProduct[] | undefined)?.find(
                      (p) => p.id === productId
                    );
                    if (!product) return null;
                    const hasCustomPrice = productId in customPrices;
                    return (
                      <div key={productId} className="flex items-center gap-3 p-3">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{product.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Default: ${product.base_price ?? 0}/lb
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs shrink-0">Custom $</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            placeholder={String(product.base_price ?? 0)}
                            value={hasCustomPrice ? customPrices[productId] : ''}
                            onChange={(e) =>
                              setProductPrice(productId, parseFloat(e.target.value) || 0)
                            }
                            className="w-24 h-8"
                          />
                          {hasCustomPrice && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-11 w-11 p-0"
                              onClick={() => removeCustomPrice(productId)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Step 4: Expiration Settings */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Expiration Settings</h3>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Never Expires</Label>
                    <p className="text-xs text-muted-foreground">
                      Menu stays active until manually burned
                    </p>
                  </div>
                  <Switch checked={neverExpires} onCheckedChange={setNeverExpires} />
                </div>
              </div>

              {!neverExpires && (
                <div className="border rounded-lg p-4 space-y-3">
                  <Label>Expiration (hours)</Label>
                  <p className="text-xs text-muted-foreground">
                    Menu auto-burns after this many hours (1-168)
                  </p>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={168}
                      value={expirationHours}
                      onChange={(e) => setExpirationHours(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <div className="text-sm font-medium w-20 text-right">
                      {expirationHours}h
                      {expirationHours >= 24 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({Math.floor(expirationHours / 24)}d{expirationHours % 24 > 0 ? ` ${expirationHours % 24}h` : ''})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {[1, 4, 12, 24, 48, 72, 168].map((h) => (
                      <Button
                        key={h}
                        variant={expirationHours === h ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setExpirationHours(h)}
                        className="text-xs"
                      >
                        {h < 24 ? `${h}h` : `${h / 24}d`}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border rounded-lg p-4 space-y-3">
                <Label>Maximum Views (1-1000)</Label>
                <p className="text-xs text-muted-foreground">
                  Menu auto-burns after reaching this many total views
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={1000}
                    value={maxViews}
                    onChange={(e) => setMaxViews(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={maxViews}
                    onChange={(e) =>
                      setMaxViews(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))
                    }
                    className="w-24"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Access Control */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Access Control</h3>

              <div className="space-y-3">
                <Label>Access Type</Label>
                <RadioGroup
                  value={accessType}
                  onValueChange={(value: string) =>
                    setAccessType(value as 'invite_only' | 'shared' | 'hybrid')
                  }
                >
                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="invite_only" id="invite_only" />
                    <div className="flex-1">
                      <Label htmlFor="invite_only" className="font-medium">
                        Invite-Only (Most Secure)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Each customer gets unique link. Track who accessed when.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="shared" id="shared" />
                    <div className="flex-1">
                      <Label htmlFor="shared" className="font-medium">
                        Shared Link (Less Secure)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        One link for all customers. Easier to distribute.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="hybrid" id="hybrid" />
                    <div className="flex-1">
                      <Label htmlFor="hybrid" className="font-medium">
                        Hybrid (Balanced)
                      </Label>
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
                  <p className="text-xs text-muted-foreground">
                    8-character alphanumeric code for additional security
                  </p>
                </div>
                <Switch checked={requireAccessCode} onCheckedChange={setRequireAccessCode} />
              </div>

              {requireAccessCode && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>Access Code</Label>
                      <Input value={accessCode} readOnly />
                    </div>
                    <Button variant="outline" onClick={generateNewCode} className="mt-6">
                      Generate New
                    </Button>
                  </div>
                  {/* QR Code preview */}
                  <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
                    <QRCodePlaceholder value={accessCode} size={80} />
                    <div className="text-sm">
                      <p className="font-medium">QR Code Preview</p>
                      <p className="text-xs text-muted-foreground">
                        Customers can scan this to access the menu
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Security Options */}
          {currentStep === 6 && (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              <h3 className="text-lg font-semibold">Security Options</h3>

              {/* Geofencing */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Geofencing</Label>
                    <p className="text-xs text-muted-foreground">
                      Only allow access from specific location
                    </p>
                  </div>
                  <Switch checked={requireGeofence} onCheckedChange={setRequireGeofence} />
                </div>
                {requireGeofence && (
                  <div className="space-y-3">
                    <div>
                      <Label>Location Name</Label>
                      <Input
                        value={geofenceLocation}
                        onChange={(e) => setGeofenceLocation(e.target.value)}
                        placeholder="New York City"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Latitude</Label>
                        <Input
                          value={geofenceLat}
                          onChange={(e) => setGeofenceLat(e.target.value)}
                          placeholder="40.7128"
                        />
                      </div>
                      <div>
                        <Label>Longitude</Label>
                        <Input
                          value={geofenceLng}
                          onChange={(e) => setGeofenceLng(e.target.value)}
                          placeholder="-74.0060"
                        />
                      </div>
                      <div>
                        <Label>Radius (miles)</Label>
                        <Select value={geofenceRadius} onValueChange={setGeofenceRadius}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select radius" />
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
                          <SelectValue placeholder="Select start hour" />
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
                          <SelectValue placeholder="Select end hour" />
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

              {/* Screenshot Protection */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Screenshot Protection</Label>
                    <p className="text-xs text-muted-foreground">
                      Detect and log screenshot attempts
                    </p>
                  </div>
                  <Switch
                    checked={screenshotProtection}
                    onCheckedChange={setScreenshotProtection}
                  />
                </div>
                {screenshotProtection && (
                  <div className="flex items-center justify-between pl-4">
                    <Label className="font-normal">Watermark with Customer ID</Label>
                    <Switch
                      checked={screenshotWatermark}
                      onCheckedChange={setScreenshotWatermark}
                    />
                  </div>
                )}
              </div>

              {/* Device Locking */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Device Fingerprinting</Label>
                    <p className="text-xs text-muted-foreground">
                      Lock to first device accessed
                    </p>
                  </div>
                  <Switch checked={deviceLocking} onCheckedChange={setDeviceLocking} />
                </div>
              </div>

              {/* Auto-Burn */}
              <div className="border rounded-lg p-4">
                <Label>Auto-Burn After</Label>
                <Select value={autoBurnHours} onValueChange={setAutoBurnHours}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
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

          {/* Step 7: Whitelist */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Access Whitelist</h3>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Whitelist</Label>
                    <p className="text-xs text-muted-foreground">
                      Only allow access from specific emails or phone numbers
                    </p>
                  </div>
                  <Switch checked={whitelistEnabled} onCheckedChange={setWhitelistEnabled} />
                </div>
              </div>

              {whitelistEnabled && (
                <>
                  {/* Email whitelist */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Whitelisted Emails
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="customer@example.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                      />
                      <Button variant="outline" onClick={addEmail}>
                        Add
                      </Button>
                    </div>
                    {whitelistedEmails.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {whitelistedEmails.map((email) => (
                          <Badge key={email} variant="secondary" className="gap-1">
                            {email}
                            <button
                              onClick={() => removeEmail(email)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Phone whitelist */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Whitelisted Phones
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="+1 (555) 123-4567"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addPhone()}
                      />
                      <Button variant="outline" onClick={addPhone}>
                        Add
                      </Button>
                    </div>
                    {whitelistedPhones.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {whitelistedPhones.map((phone) => (
                          <Badge key={phone} variant="secondary" className="gap-1">
                            {phone}
                            <button
                              onClick={() => removePhone(phone)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 8: Notifications */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Alert Notifications</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <Label>Suspicious IP Access</Label>
                    <p className="text-xs text-muted-foreground">
                      Unknown IP tries to access menu
                    </p>
                  </div>
                  <Switch
                    checked={notifyOnSuspiciousIp}
                    onCheckedChange={setNotifyOnSuspiciousIp}
                  />
                </div>

                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <Label>Failed Access Codes</Label>
                    <p className="text-xs text-muted-foreground">
                      Access code fails 3+ times
                    </p>
                  </div>
                  <Switch
                    checked={notifyOnFailedCode}
                    onCheckedChange={setNotifyOnFailedCode}
                  />
                </div>

                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <Label>High View Count</Label>
                    <p className="text-xs text-muted-foreground">
                      Menu viewed 50+ times in one day
                    </p>
                  </div>
                  <Switch
                    checked={notifyOnHighViews}
                    onCheckedChange={setNotifyOnHighViews}
                  />
                </div>

                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <Label>Link Sharing Attempt</Label>
                    <p className="text-xs text-muted-foreground">
                      Customer tries to share invite link
                    </p>
                  </div>
                  <Switch
                    checked={notifyOnShareAttempt}
                    onCheckedChange={setNotifyOnShareAttempt}
                  />
                </div>

                <div className="flex items-center justify-between border rounded p-3">
                  <div>
                    <Label>Geofence Violations</Label>
                    <p className="text-xs text-muted-foreground">
                      Access attempted outside allowed area
                    </p>
                  </div>
                  <Switch
                    checked={notifyOnGeofenceViolation}
                    onCheckedChange={setNotifyOnGeofenceViolation}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 9: Branding */}
          {currentStep === 9 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Menu Branding</h3>

              <div className="flex items-center justify-between border rounded p-3">
                <div>
                  <Label>Show Branding</Label>
                  <p className="text-xs text-muted-foreground">
                    Display your business branding on the menu
                  </p>
                </div>
                <Switch checked={showBranding} onCheckedChange={setShowBranding} />
              </div>

              <div className="space-y-3">
                <Label>Menu Style</Label>
                <RadioGroup
                  value={appearanceStyle}
                  onValueChange={(value) => {
                    if (
                      value === 'professional' ||
                      value === 'minimal' ||
                      value === 'anonymous'
                    ) {
                      setAppearanceStyle(value);
                    }
                  }}
                >
                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="professional" id="professional" />
                    <div className="flex-1">
                      <Label htmlFor="professional" className="font-medium">
                        Professional
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Looks like catalog with images
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="minimal" id="minimal" />
                    <div className="flex-1">
                      <Label htmlFor="minimal" className="font-medium">
                        Minimal
                      </Label>
                      <p className="text-xs text-muted-foreground">Text-only, clean design</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2 border rounded p-3">
                    <RadioGroupItem value="anonymous" id="anonymous" />
                    <div className="flex-1">
                      <Label htmlFor="anonymous" className="font-medium">
                        Anonymous
                      </Label>
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
                    <Switch
                      checked={showProductImages}
                      onCheckedChange={setShowProductImages}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="font-normal">Show availability</Label>
                    <Switch
                      checked={showAvailability}
                      onCheckedChange={setShowAvailability}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="font-normal">Show contact info</Label>
                    <Switch checked={showContactInfo} onCheckedChange={setShowContactInfo} />
                  </div>
                </div>
              </div>

              {/* Header Image */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Header Image URL
                </Label>
                <Input
                  type="url"
                  placeholder="https://example.com/banner.jpg"
                  value={headerImage}
                  onChange={(e) => setHeaderImage(e.target.value)}
                />
                {headerImage && (
                  <div className="border rounded-lg overflow-hidden h-24">
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
                  <p>
                    <strong>Name:</strong> {menuOptions.name || '(not set)'}
                  </p>
                  <p>
                    <strong>Products:</strong> {menuOptions.products.length} selected
                  </p>
                  <p>
                    <strong>Custom Prices:</strong>{' '}
                    {Object.keys(menuOptions.customPrices).length > 0
                      ? `${Object.keys(menuOptions.customPrices).length} products`
                      : 'None'}
                    {menuOptions.applyDiscount && ` | ${menuOptions.discountPercent}% discount`}
                  </p>
                  <p>
                    <strong>Expiration:</strong>{' '}
                    {neverExpires ? 'Never' : `${menuOptions.expirationHours}h`} | Max{' '}
                    {menuOptions.maxViews} views
                  </p>
                  <p>
                    <strong>Access:</strong> {accessType.replace('_', ' ')}
                  </p>
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
                  {menuOptions.whitelistEnabled && (
                    <p>
                      <strong>Whitelist:</strong> {menuOptions.whitelistedEmails.length} emails,{' '}
                      {menuOptions.whitelistedPhones.length} phones
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <div className="flex flex-col items-center">
              <Button
                onClick={handleCreate}
                disabled={createMenu.isPending}
                className="w-full"
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
              {showLongLoadingMessage && (
                <p className="text-xs text-yellow-600 text-center mt-2 animate-pulse">
                  This is taking longer than usual. Please wait...
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      <MenuAccessDetails
        open={createdMenuDetails !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCreatedMenuDetails(null);
        }}
        accessCode={createdMenuDetails?.accessCode ?? ''}
        shareableUrl={createdMenuDetails?.shareableUrl ?? ''}
        menuName={createdMenuDetails?.menuName ?? ''}
      />
    </Dialog>
  );
};
