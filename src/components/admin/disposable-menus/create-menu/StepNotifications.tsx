import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface StepNotificationsProps {
  notifyOnSuspiciousIp: boolean;
  onNotifyOnSuspiciousIpChange: (value: boolean) => void;
  notifyOnFailedCode: boolean;
  onNotifyOnFailedCodeChange: (value: boolean) => void;
  notifyOnHighViews: boolean;
  onNotifyOnHighViewsChange: (value: boolean) => void;
  notifyOnShareAttempt: boolean;
  onNotifyOnShareAttemptChange: (value: boolean) => void;
  notifyOnGeofenceViolation: boolean;
  onNotifyOnGeofenceViolationChange: (value: boolean) => void;
}

export function StepNotifications({
  notifyOnSuspiciousIp,
  onNotifyOnSuspiciousIpChange,
  notifyOnFailedCode,
  onNotifyOnFailedCodeChange,
  notifyOnHighViews,
  onNotifyOnHighViewsChange,
  notifyOnShareAttempt,
  onNotifyOnShareAttemptChange,
  notifyOnGeofenceViolation,
  onNotifyOnGeofenceViolationChange,
}: StepNotificationsProps) {
  return (
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
            onCheckedChange={onNotifyOnSuspiciousIpChange}
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
            onCheckedChange={onNotifyOnFailedCodeChange}
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
            onCheckedChange={onNotifyOnHighViewsChange}
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
            onCheckedChange={onNotifyOnShareAttemptChange}
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
            onCheckedChange={onNotifyOnGeofenceViolationChange}
          />
        </div>
      </div>
    </div>
  );
}
