import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { InventoryProduct, GeofenceConfig } from '@/components/admin/disposable-menus/wizard/types';
import { STANDARD_TIERS, validateEmail, validatePhone } from '@/components/admin/disposable-menus/wizard/types';

import { DollarSign, MapPin, Users, Palette, Percent, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface AdvancedStepProps {
  advancedTab: string;
  onAdvancedTabChange: (value: string) => void;
  // Pricing
  applyDiscount: boolean;
  onApplyDiscountChange: (value: boolean) => void;
  discountPercent: string;
  onDiscountPercentChange: (value: string) => void;
  selectedProducts: string[];
  getProductById: (id: string) => InventoryProduct | undefined;
  getEffectivePrice: (product: InventoryProduct) => number;
  customPrices: Record<string, string>;
  onCustomPricesChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  tieredPrices: Record<string, Record<string, string>>;
  onTierPriceChange: (productId: string, tierLabel: string, value: string) => void;
  // Geofencing
  geofencingEnabled: boolean;
  onGeofencingEnabledChange: (value: boolean) => void;
  geofence: GeofenceConfig;
  onGeofenceChange: (updater: (prev: GeofenceConfig) => GeofenceConfig) => void;
  // Whitelist
  whitelistEnabled: boolean;
  onWhitelistEnabledChange: (value: boolean) => void;
  whitelistedEmails: string[];
  onWhitelistedEmailsChange: (updater: (prev: string[]) => string[]) => void;
  whitelistedPhones: string[];
  onWhitelistedPhonesChange: (updater: (prev: string[]) => string[]) => void;
  emailInput: string;
  onEmailInputChange: (value: string) => void;
  phoneInput: string;
  onPhoneInputChange: (value: string) => void;
  // Branding
  showBranding: boolean;
  onShowBrandingChange: (value: boolean) => void;
  headerImage: string;
  onHeaderImageChange: (value: string) => void;
  customMessage: string;
  onCustomMessageChange: (value: string) => void;
  businessName: string | undefined;
}

export const AdvancedStep = ({
  advancedTab,
  onAdvancedTabChange,
  applyDiscount,
  onApplyDiscountChange,
  discountPercent,
  onDiscountPercentChange,
  selectedProducts,
  getProductById,
  getEffectivePrice,
  customPrices,
  onCustomPricesChange,
  tieredPrices,
  onTierPriceChange,
  geofencingEnabled,
  onGeofencingEnabledChange,
  geofence,
  onGeofenceChange,
  whitelistEnabled,
  onWhitelistEnabledChange,
  whitelistedEmails,
  onWhitelistedEmailsChange,
  whitelistedPhones,
  onWhitelistedPhonesChange,
  emailInput,
  onEmailInputChange,
  phoneInput,
  onPhoneInputChange,
  showBranding,
  onShowBrandingChange,
  headerImage,
  onHeaderImageChange,
  customMessage,
  onCustomMessageChange,
  businessName,
}: AdvancedStepProps) => {
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
    onWhitelistedEmailsChange((prev) => [...prev, trimmed]);
    onEmailInputChange('');
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
    onWhitelistedPhonesChange((prev) => [...prev, trimmed]);
    onPhoneInputChange('');
  };

  const handleRemoveEmail = (email: string) => {
    onWhitelistedEmailsChange((prev) => prev.filter((e) => e !== email));
  };

  const handleRemovePhone = (phone: string) => {
    onWhitelistedPhonesChange((prev) => prev.filter((p) => p !== phone));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Advanced Options</h3>
      <p className="text-sm text-muted-foreground">
        Configure custom pricing, location restrictions, access control, and branding.
      </p>

      <Tabs value={advancedTab} onValueChange={onAdvancedTabChange}>
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
          <PricingTab
            applyDiscount={applyDiscount}
            onApplyDiscountChange={onApplyDiscountChange}
            discountPercent={discountPercent}
            onDiscountPercentChange={onDiscountPercentChange}
            selectedProducts={selectedProducts}
            getProductById={getProductById}
            getEffectivePrice={getEffectivePrice}
            customPrices={customPrices}
            onCustomPricesChange={onCustomPricesChange}
            tieredPrices={tieredPrices}
            onTierPriceChange={onTierPriceChange}
          />
        </TabsContent>

        {/* Geofencing Tab */}
        <TabsContent value="geofence" className="space-y-4 mt-4">
          <GeofenceTab
            geofencingEnabled={geofencingEnabled}
            onGeofencingEnabledChange={onGeofencingEnabledChange}
            geofence={geofence}
            onGeofenceChange={onGeofenceChange}
          />
        </TabsContent>

        {/* Whitelist Tab */}
        <TabsContent value="whitelist" className="space-y-4 mt-4">
          <WhitelistTab
            whitelistEnabled={whitelistEnabled}
            onWhitelistEnabledChange={onWhitelistEnabledChange}
            whitelistedEmails={whitelistedEmails}
            whitelistedPhones={whitelistedPhones}
            emailInput={emailInput}
            onEmailInputChange={onEmailInputChange}
            phoneInput={phoneInput}
            onPhoneInputChange={onPhoneInputChange}
            onAddEmail={handleAddEmail}
            onAddPhone={handleAddPhone}
            onRemoveEmail={handleRemoveEmail}
            onRemovePhone={handleRemovePhone}
          />
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4 mt-4">
          <BrandingTab
            showBranding={showBranding}
            onShowBrandingChange={onShowBrandingChange}
            headerImage={headerImage}
            onHeaderImageChange={onHeaderImageChange}
            customMessage={customMessage}
            onCustomMessageChange={onCustomMessageChange}
            businessName={businessName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Sub-tabs                                                          */
/* ------------------------------------------------------------------ */

interface PricingTabProps {
  applyDiscount: boolean;
  onApplyDiscountChange: (value: boolean) => void;
  discountPercent: string;
  onDiscountPercentChange: (value: string) => void;
  selectedProducts: string[];
  getProductById: (id: string) => InventoryProduct | undefined;
  getEffectivePrice: (product: InventoryProduct) => number;
  customPrices: Record<string, string>;
  onCustomPricesChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  tieredPrices: Record<string, Record<string, string>>;
  onTierPriceChange: (productId: string, tierLabel: string, value: string) => void;
}

const PricingTab = ({
  applyDiscount,
  onApplyDiscountChange,
  discountPercent,
  onDiscountPercentChange,
  selectedProducts,
  getProductById,
  getEffectivePrice,
  customPrices,
  onCustomPricesChange,
  tieredPrices,
  onTierPriceChange,
}: PricingTabProps) => {
  return (
    <>
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
              onCheckedChange={onApplyDiscountChange}
            />
          </div>
          {applyDiscount && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="100"
                value={discountPercent}
                onChange={(e) => onDiscountPercentChange(e.target.value)}
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
              {selectedProducts.map((productId) => {
                const product = getProductById(productId);
                if (!product) return null;
                const effectivePrice = getEffectivePrice(product);
                const hasCustomPrice = customPrices[productId] && customPrices[productId].trim() !== '';

                return (
                  <div key={productId} className="space-y-2 p-2 border rounded">
                    <div className="flex items-center gap-3">
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
                          value={customPrices[productId] ?? ''}
                          onChange={(e) =>
                            onCustomPricesChange((prev) => ({
                              ...prev,
                              [productId]: e.target.value,
                            }))
                          }
                          className="w-24 h-8 text-sm"
                        />
                      </div>
                      {hasCustomPrice && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            onCustomPricesChange((prev) => {
                              const updated = { ...prev };
                              delete updated[productId];
                              return updated;
                            })
                          }
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    {/* Tiered pricing row */}
                    <div className="flex flex-wrap gap-2 pl-1">
                      {STANDARD_TIERS.map((tier) => (
                        <div key={tier.label} className="flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground w-7">{tier.label}</span>
                          <span className="text-[11px] text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="—"
                            value={tieredPrices[productId]?.[tier.label] ?? ''}
                            onChange={(e) => onTierPriceChange(productId, tier.label, e.target.value)}
                            className="w-16 h-7 text-xs px-1.5"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

interface GeofenceTabProps {
  geofencingEnabled: boolean;
  onGeofencingEnabledChange: (value: boolean) => void;
  geofence: GeofenceConfig;
  onGeofenceChange: (updater: (prev: GeofenceConfig) => GeofenceConfig) => void;
}

const GeofenceTab = ({
  geofencingEnabled,
  onGeofencingEnabledChange,
  geofence,
  onGeofenceChange,
}: GeofenceTabProps) => {
  return (
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
            onCheckedChange={onGeofencingEnabledChange}
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
                  onChange={(e) => onGeofenceChange((prev) => ({ ...prev, lat: e.target.value }))}
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
                  onChange={(e) => onGeofenceChange((prev) => ({ ...prev, lng: e.target.value }))}
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
                onChange={(e) => onGeofenceChange((prev) => ({ ...prev, radiusMiles: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Customers must be within this radius to access the menu
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface WhitelistTabProps {
  whitelistEnabled: boolean;
  onWhitelistEnabledChange: (value: boolean) => void;
  whitelistedEmails: string[];
  whitelistedPhones: string[];
  emailInput: string;
  onEmailInputChange: (value: string) => void;
  phoneInput: string;
  onPhoneInputChange: (value: string) => void;
  onAddEmail: () => void;
  onAddPhone: () => void;
  onRemoveEmail: (email: string) => void;
  onRemovePhone: (phone: string) => void;
}

const WhitelistTab = ({
  whitelistEnabled,
  onWhitelistEnabledChange,
  whitelistedEmails,
  whitelistedPhones,
  emailInput,
  onEmailInputChange,
  phoneInput,
  onPhoneInputChange,
  onAddEmail,
  onAddPhone,
  onRemoveEmail,
  onRemovePhone,
}: WhitelistTabProps) => {
  return (
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
            onCheckedChange={onWhitelistEnabledChange}
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
                  onChange={(e) => onEmailInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddEmail();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddEmail}
                  aria-label="Add email"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {whitelistedEmails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {whitelistedEmails.map((email) => (
                    <Badge key={email} variant="secondary" className="flex items-center gap-1">
                      {email}
                      <button
                        onClick={() => onRemoveEmail(email)}
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
                  onChange={(e) => onPhoneInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddPhone();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddPhone}
                  aria-label="Add phone number"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {whitelistedPhones.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {whitelistedPhones.map((phone) => (
                    <Badge key={phone} variant="secondary" className="flex items-center gap-1">
                      {phone}
                      <button
                        onClick={() => onRemovePhone(phone)}
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
  );
};

interface BrandingTabProps {
  showBranding: boolean;
  onShowBrandingChange: (value: boolean) => void;
  headerImage: string;
  onHeaderImageChange: (value: string) => void;
  customMessage: string;
  onCustomMessageChange: (value: string) => void;
  businessName: string | undefined;
}

const BrandingTab = ({
  showBranding,
  onShowBrandingChange,
  headerImage,
  onHeaderImageChange,
  customMessage,
  onCustomMessageChange,
  businessName,
}: BrandingTabProps) => {
  return (
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
            onCheckedChange={onShowBrandingChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="headerImage">Header Image URL</Label>
          <Input
            id="headerImage"
            type="url"
            placeholder="https://example.com/banner.jpg"
            value={headerImage}
            onChange={(e) => onHeaderImageChange(e.target.value)}
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
            onChange={(e) => onCustomMessageChange(e.target.value)}
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
                  {businessName ?? 'Your Business'}
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
  );
};
