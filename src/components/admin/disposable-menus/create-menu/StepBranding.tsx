import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Image } from 'lucide-react';
import type { AppearanceStyle, MenuOptions } from './types';

interface StepBrandingProps {
  showBranding: boolean;
  onShowBrandingChange: (value: boolean) => void;
  appearanceStyle: AppearanceStyle;
  onAppearanceStyleChange: (value: AppearanceStyle) => void;
  showProductImages: boolean;
  onShowProductImagesChange: (value: boolean) => void;
  showAvailability: boolean;
  onShowAvailabilityChange: (value: boolean) => void;
  showContactInfo: boolean;
  onShowContactInfoChange: (value: boolean) => void;
  customMessage: string;
  onCustomMessageChange: (value: string) => void;
  headerImage: string;
  onHeaderImageChange: (value: string) => void;
  // Summary data
  menuOptions: MenuOptions;
  neverExpires: boolean;
  accessType: string;
  requireAccessCode: boolean;
  requireGeofence: boolean;
  timeRestrictions: boolean;
  screenshotProtection: boolean;
  deviceLocking: boolean;
}

export function StepBranding({
  showBranding,
  onShowBrandingChange,
  appearanceStyle,
  onAppearanceStyleChange,
  showProductImages,
  onShowProductImagesChange,
  showAvailability,
  onShowAvailabilityChange,
  showContactInfo,
  onShowContactInfoChange,
  customMessage,
  onCustomMessageChange,
  headerImage,
  onHeaderImageChange,
  menuOptions,
  neverExpires,
  accessType,
  requireAccessCode,
  requireGeofence,
  timeRestrictions,
  screenshotProtection,
  deviceLocking,
}: StepBrandingProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Menu Branding</h3>

      <div className="flex items-center justify-between border rounded p-3">
        <div>
          <Label>Show Branding</Label>
          <p className="text-xs text-muted-foreground">
            Display your business branding on the menu
          </p>
        </div>
        <Switch checked={showBranding} onCheckedChange={onShowBrandingChange} />
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
              onAppearanceStyleChange(value);
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
              onCheckedChange={onShowProductImagesChange}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="font-normal">Show availability</Label>
            <Switch
              checked={showAvailability}
              onCheckedChange={onShowAvailabilityChange}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="font-normal">Show contact info</Label>
            <Switch checked={showContactInfo} onCheckedChange={onShowContactInfoChange} />
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
          onChange={(e) => onHeaderImageChange(e.target.value)}
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
          onChange={(e) => onCustomMessageChange(e.target.value)}
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
  );
}
