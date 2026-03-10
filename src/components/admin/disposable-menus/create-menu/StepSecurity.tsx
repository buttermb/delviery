import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StepSecurityProps {
  requireGeofence: boolean;
  onRequireGeofenceChange: (value: boolean) => void;
  geofenceLat: string;
  onGeofenceLatChange: (value: string) => void;
  geofenceLng: string;
  onGeofenceLngChange: (value: string) => void;
  geofenceRadius: string;
  onGeofenceRadiusChange: (value: string) => void;
  geofenceLocation: string;
  onGeofenceLocationChange: (value: string) => void;
  timeRestrictions: boolean;
  onTimeRestrictionsChange: (value: boolean) => void;
  allowedHoursStart: string;
  onAllowedHoursStartChange: (value: string) => void;
  allowedHoursEnd: string;
  onAllowedHoursEndChange: (value: string) => void;
  screenshotProtection: boolean;
  onScreenshotProtectionChange: (value: boolean) => void;
  screenshotWatermark: boolean;
  onScreenshotWatermarkChange: (value: boolean) => void;
  deviceLocking: boolean;
  onDeviceLockingChange: (value: boolean) => void;
  autoBurnHours: string;
  onAutoBurnHoursChange: (value: string) => void;
}

export function StepSecurity({
  requireGeofence,
  onRequireGeofenceChange,
  geofenceLat,
  onGeofenceLatChange,
  geofenceLng,
  onGeofenceLngChange,
  geofenceRadius,
  onGeofenceRadiusChange,
  geofenceLocation,
  onGeofenceLocationChange,
  timeRestrictions,
  onTimeRestrictionsChange,
  allowedHoursStart,
  onAllowedHoursStartChange,
  allowedHoursEnd,
  onAllowedHoursEndChange,
  screenshotProtection,
  onScreenshotProtectionChange,
  screenshotWatermark,
  onScreenshotWatermarkChange,
  deviceLocking,
  onDeviceLockingChange,
  autoBurnHours,
  onAutoBurnHoursChange,
}: StepSecurityProps) {
  return (
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
          <Switch checked={requireGeofence} onCheckedChange={onRequireGeofenceChange} />
        </div>
        {requireGeofence && (
          <div className="space-y-3">
            <div>
              <Label>Location Name</Label>
              <Input
                value={geofenceLocation}
                onChange={(e) => onGeofenceLocationChange(e.target.value)}
                placeholder="New York City"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input
                  value={geofenceLat}
                  onChange={(e) => onGeofenceLatChange(e.target.value)}
                  placeholder="40.7128"
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  value={geofenceLng}
                  onChange={(e) => onGeofenceLngChange(e.target.value)}
                  placeholder="-74.0060"
                />
              </div>
              <div>
                <Label>Radius (miles)</Label>
                <Select value={geofenceRadius} onValueChange={onGeofenceRadiusChange}>
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
          <Switch checked={timeRestrictions} onCheckedChange={onTimeRestrictionsChange} />
        </div>
        {timeRestrictions && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Hour</Label>
              <Select value={allowedHoursStart} onValueChange={onAllowedHoursStartChange}>
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
              <Select value={allowedHoursEnd} onValueChange={onAllowedHoursEndChange}>
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
            onCheckedChange={onScreenshotProtectionChange}
          />
        </div>
        {screenshotProtection && (
          <div className="flex items-center justify-between pl-4">
            <Label className="font-normal">Watermark with Customer ID</Label>
            <Switch
              checked={screenshotWatermark}
              onCheckedChange={onScreenshotWatermarkChange}
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
          <Switch checked={deviceLocking} onCheckedChange={onDeviceLockingChange} />
        </div>
      </div>

      {/* Auto-Burn */}
      <div className="border rounded-lg p-4">
        <Label>Auto-Burn After</Label>
        <Select value={autoBurnHours} onValueChange={onAutoBurnHoursChange}>
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
  );
}
