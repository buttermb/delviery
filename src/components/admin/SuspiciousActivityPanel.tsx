import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  Monitor,
  Smartphone,
  Tablet,
  Shield,
  ShieldCheck,
  ShieldX,
  CheckCircle,
  XCircle,
  Trash2,
  Clock,
  MapPin,
  Globe,
} from 'lucide-react';
import { useKnownDevices, type KnownDevice, type SuspiciousLoginAlert } from '@/hooks/useKnownDevices';
import { toast } from 'sonner';
import { formatSmartDate } from '@/lib/formatters';

interface SuspiciousActivityPanelProps {
  userId: string;
}

function getDeviceIcon(deviceType: string | null) {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className="h-4 w-4" />;
    case 'tablet':
      return <Tablet className="h-4 w-4" />;
    default:
      return <Monitor className="h-4 w-4" />;
  }
}

function getAlertBadge(alertType: string) {
  switch (alertType) {
    case 'new_device_and_location':
      return <Badge variant="destructive">New Device & Location</Badge>;
    case 'new_device':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">New Device</Badge>;
    case 'new_location':
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800">New Location</Badge>;
    default:
      return <Badge variant="secondary">{alertType}</Badge>;
  }
}

function formatDate(dateStr: string): string {
  return formatSmartDate(dateStr, { includeTime: true });
}

function DeviceCard({ device, onTrust, onUntrust, onRemove, isTrusting, isRemoving }: {
  device: KnownDevice;
  onTrust: (id: string) => void;
  onUntrust: (id: string) => void;
  onRemove: (id: string) => void;
  isTrusting: boolean;
  isRemoving: boolean;
}) {
  return (
    <div className="flex items-start justify-between p-3 border rounded-lg">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">
          {getDeviceIcon(device.device_type)}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{device.device_name || 'Unknown Device'}</span>
            {device.is_trusted ? (
              <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Trusted
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                Untrusted
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {device.geo_city && device.geo_country && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {device.geo_city}, {device.geo_country}
              </span>
            )}
            {device.ip_address && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {device.ip_address}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              First seen: {formatDate(device.first_seen_at)}
            </span>
            <span>Last seen: {formatDate(device.last_seen_at)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {device.is_trusted ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUntrust(device.id)}
            disabled={isTrusting}
            title="Untrust device"
          >
            <ShieldX className="h-4 w-4 text-yellow-600" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onTrust(device.id);
              toast.success('Device trusted');
            }}
            disabled={isTrusting}
            title="Trust device"
          >
            <ShieldCheck className="h-4 w-4 text-green-600" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onRemove(device.id);
            toast.success('Device removed');
          }}
          disabled={isRemoving}
          title="Remove device"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

function AlertCard({ alert, onConfirm, isConfirming }: {
  alert: SuspiciousLoginAlert;
  onConfirm: (id: string) => void;
  isConfirming: boolean;
}) {
  return (
    <div className="flex items-start justify-between p-3 border rounded-lg">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <AlertTriangle className={`h-4 w-4 ${
            alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
          }`} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {getAlertBadge(alert.alert_type)}
            <span className="text-xs text-muted-foreground">{formatDate(alert.created_at)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {alert.browser} on {alert.os} ({alert.device_type || 'unknown'})
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {alert.geo_city && alert.geo_country && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {alert.geo_city}, {alert.geo_country}
              </span>
            )}
            {alert.ip_address && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {alert.ip_address}
              </span>
            )}
          </div>
          {alert.user_response && (
            <div className="flex items-center gap-1 text-xs">
              {alert.user_response === 'confirmed_me' ? (
                <><CheckCircle className="h-3 w-3 text-green-500" /> Confirmed by user</>
              ) : alert.user_response === 'not_me' ? (
                <><XCircle className="h-3 w-3 text-red-500" /> Reported as unauthorized</>
              ) : (
                <span className="text-muted-foreground">Ignored</span>
              )}
            </div>
          )}
        </div>
      </div>
      {!alert.user_response && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onConfirm(alert.id);
            toast.success('Login confirmed as legitimate');
          }}
          disabled={isConfirming}
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Was me
        </Button>
      )}
    </div>
  );
}

export function SuspiciousActivityPanel({ userId }: SuspiciousActivityPanelProps) {
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const {
    devices,
    isLoadingDevices,
    alerts,
    isLoadingAlerts,
    pendingAlerts,
    trustDevice,
    isTrusting,
    untrustDevice,
    isUntrusting,
    removeDevice,
    isRemoving,
    confirmAlert,
    isConfirming,
  } = useKnownDevices(userId);

  const displayedAlerts = showAllAlerts ? alerts : alerts.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Pending Alerts */}
      {pendingAlerts.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Pending Security Alerts
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                {pendingAlerts.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              These logins require your attention. Confirm if they were you, or secure your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onConfirm={confirmAlert}
                isConfirming={isConfirming}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Known Devices */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Known Devices
          </CardTitle>
          <CardDescription>
            Devices that have accessed your account. Trusted devices won&apos;t trigger security alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingDevices ? (
            <p className="text-sm text-muted-foreground">Loading devices...</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No devices recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {devices.map(device => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onTrust={trustDevice}
                  onUntrust={untrustDevice}
                  onRemove={removeDevice}
                  isTrusting={isTrusting || isUntrusting}
                  isRemoving={isRemoving}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Login Alert History
          </CardTitle>
          <CardDescription>
            Recent suspicious login alerts and their resolution status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAlerts ? (
            <p className="text-sm text-muted-foreground">Loading alerts...</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suspicious login alerts.</p>
          ) : (
            <div className="space-y-2">
              {displayedAlerts.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onConfirm={confirmAlert}
                  isConfirming={isConfirming}
                />
              ))}
              {alerts.length > 5 && (
                <>
                  <Separator className="my-3" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllAlerts(!showAllAlerts)}
                    className="w-full"
                  >
                    {showAllAlerts ? 'Show less' : `Show all ${alerts.length} alerts`}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
