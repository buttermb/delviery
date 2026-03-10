import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SettingsStepProps {
  accessType: 'invite_only' | 'shared' | 'hybrid';
  onAccessTypeChange: (value: 'invite_only' | 'shared' | 'hybrid') => void;
  requireAccessCode: boolean;
  onRequireAccessCodeChange: (value: boolean) => void;
  accessCode: string;
  onGenerateNewCode: () => void;
  requirePassword: boolean;
  onRequirePasswordChange: (value: boolean) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  expirationDays: string;
  onExpirationDaysChange: (value: string) => void;
  burnAfterRead: boolean;
  onBurnAfterReadChange: (value: boolean) => void;
  maxViews: string;
  onMaxViewsChange: (value: string) => void;
  // Advanced options summary
  applyDiscount: boolean;
  discountPercent: string;
  geofencingEnabled: boolean;
  geofenceRadiusMiles: string;
  whitelistEnabled: boolean;
  whitelistedEmailCount: number;
  whitelistedPhoneCount: number;
  customPriceCount: number;
}

export const SettingsStep = ({
  accessType,
  onAccessTypeChange,
  requireAccessCode,
  onRequireAccessCodeChange,
  accessCode,
  onGenerateNewCode,
  requirePassword,
  onRequirePasswordChange,
  password,
  onPasswordChange,
  expirationDays,
  onExpirationDaysChange,
  burnAfterRead,
  onBurnAfterReadChange,
  maxViews,
  onMaxViewsChange,
  applyDiscount,
  discountPercent,
  geofencingEnabled,
  geofenceRadiusMiles,
  whitelistEnabled,
  whitelistedEmailCount,
  whitelistedPhoneCount,
  customPriceCount,
}: SettingsStepProps) => {
  const hasAdvancedOptions =
    applyDiscount || geofencingEnabled || whitelistEnabled || customPriceCount > 0;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Menu Settings</h3>

      {/* Access Type */}
      <div className="space-y-3">
        <Label>Access Type</Label>
        <RadioGroup
          value={accessType}
          onValueChange={(value: string) =>
            onAccessTypeChange(value as 'invite_only' | 'shared' | 'hybrid')
          }
        >
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
          onCheckedChange={onRequireAccessCodeChange}
        />
      </div>

      {requireAccessCode && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Label>Access Code</Label>
            <Input value={accessCode} readOnly className="font-mono" />
          </div>
          <Button variant="outline" onClick={onGenerateNewCode} className="mt-6">
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
          onCheckedChange={onRequirePasswordChange}
        />
      </div>

      {requirePassword && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Enter password"
          />
        </div>
      )}

      {/* Expiration */}
      <div className="space-y-2">
        <Label htmlFor="expiration">Expiration (days)</Label>
        <Select value={expirationDays} onValueChange={onExpirationDaysChange}>
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
          onCheckedChange={onBurnAfterReadChange}
        />
      </div>

      {/* Max Views */}
      <div className="space-y-2">
        <Label htmlFor="maxViews">Max Views</Label>
        <Select value={maxViews} onValueChange={onMaxViewsChange}>
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
      {hasAdvancedOptions && (
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Advanced Options Applied:</p>
          <div className="flex flex-wrap gap-2">
            {applyDiscount && (
              <Badge variant="secondary" className="text-xs">
                {discountPercent}% Discount
              </Badge>
            )}
            {customPriceCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {customPriceCount} Custom Prices
              </Badge>
            )}
            {geofencingEnabled && (
              <Badge variant="secondary" className="text-xs">
                Geofenced ({geofenceRadiusMiles}mi)
              </Badge>
            )}
            {whitelistEnabled && (
              <Badge variant="secondary" className="text-xs">
                {whitelistedEmailCount + whitelistedPhoneCount} Whitelisted
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
