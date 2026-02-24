import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Flame, AlertTriangle, Shield } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { FieldHelp, fieldHelpTexts } from '@/components/ui/field-help';

interface AutoBurnConfig {
  enabled: boolean;
  triggers: {
    view_limit_exceeded: { enabled: boolean; threshold: number };
    failed_access_attempts: { enabled: boolean; threshold: number };
    screenshot_detected: { enabled: boolean; threshold: number };
    geofence_violations: { enabled: boolean; threshold: number };
    time_expired: { enabled: boolean };
    suspicious_activity: { enabled: boolean };
  };
  burn_type: 'soft' | 'hard';
  notify_on_burn: boolean;
  auto_regenerate: boolean;
  migrate_customers: boolean;
}

interface AutoBurnSettingsProps {
  settings: AutoBurnConfig;
  onChange: (settings: AutoBurnConfig) => void;
}

export const AutoBurnSettings = ({ settings, onChange }: AutoBurnSettingsProps) => {
  const [config, setConfig] = useState<AutoBurnConfig>(settings || {
    enabled: false,
    triggers: {
      view_limit_exceeded: { enabled: false, threshold: 10 },
      failed_access_attempts: { enabled: false, threshold: 5 },
      screenshot_detected: { enabled: false, threshold: 3 },
      geofence_violations: { enabled: false, threshold: 2 },
      time_expired: { enabled: false },
      suspicious_activity: { enabled: false }
    },
    burn_type: 'soft' as const,
    notify_on_burn: true,
    auto_regenerate: false,
    migrate_customers: false
  });

  const updateConfig = (updates: Partial<AutoBurnConfig>) => {
    const newConfig = { ...config, ...updates } as AutoBurnConfig;
    setConfig(newConfig);
    onChange(newConfig);
  };

  const updateTrigger = (trigger: string, updates: Partial<AutoBurnConfig['triggers'][keyof AutoBurnConfig['triggers']]>) => {
    const newTriggers = {
      ...config.triggers,
      [trigger]: { ...config.triggers[trigger], ...updates }
    };
    updateConfig({ triggers: newTriggers });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Auto-Burn System</h3>
            <FieldHelp tooltip={fieldHelpTexts.autoBurnSystem.tooltip} size="md" />
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig({ enabled: checked })}
            aria-label="Enable auto-burn system"
          />
        </div>

        {config.enabled && (
          <>
            <div className="mb-4 p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
              <div className="text-xs text-warning">
                Auto-burn will permanently disable menu access when triggers are activated. Use with caution.
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-6">
              {/* Burn Type */}
              <div>
              <Label className="flex items-center gap-1.5">
                Burn Type
                <FieldHelp tooltip={fieldHelpTexts.burnType.tooltip} variant="warning" />
              </Label>
                <Select
                  value={config.burn_type}
                  onValueChange={(value) => updateConfig({ burn_type: value as 'soft' | 'hard' })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select burn type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soft">
                      Soft Burn (Can be regenerated)
                    </SelectItem>
                    <SelectItem value="hard">
                      Hard Burn (Permanent destruction)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Triggers */}
              <div className="space-y-4">
                <Label className="text-base font-semibold flex items-center gap-1.5">
                  Burn Triggers
                  <FieldHelp tooltip={fieldHelpTexts.burnTriggers.tooltip} />
                </Label>

                {/* View Limit Exceeded */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Label className="font-medium">View Limit Exceeded</Label>
                      <p className="text-xs text-muted-foreground">
                        Burn when total views exceed threshold
                      </p>
                    </div>
                    <Switch
                      checked={config.triggers.view_limit_exceeded.enabled}
                      onCheckedChange={(checked) =>
                        updateTrigger('view_limit_exceeded', { enabled: checked })
                      }
                    />
                  </div>
                  {config.triggers.view_limit_exceeded.enabled && (
                    <div>
                      <Label className="text-xs">Threshold</Label>
                      <Input
                        type="number"
                        min="1"
                        value={config.triggers.view_limit_exceeded.threshold}
                        onChange={(e) =>
                          updateTrigger('view_limit_exceeded', {
                            threshold: parseInt(e.target.value)
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  )}
                </Card>

                {/* Failed Access Attempts */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Label className="font-medium">Failed Access Attempts</Label>
                      <p className="text-xs text-muted-foreground">
                        Burn after multiple failed login attempts
                      </p>
                    </div>
                    <Switch
                      checked={config.triggers.failed_access_attempts.enabled}
                      onCheckedChange={(checked) =>
                        updateTrigger('failed_access_attempts', { enabled: checked })
                      }
                    />
                  </div>
                  {config.triggers.failed_access_attempts.enabled && (
                    <div>
                      <Label className="text-xs">Threshold</Label>
                      <Input
                        type="number"
                        min="1"
                        value={config.triggers.failed_access_attempts.threshold}
                        onChange={(e) =>
                          updateTrigger('failed_access_attempts', {
                            threshold: parseInt(e.target.value)
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  )}
                </Card>

                {/* Screenshot Detected */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Label className="font-medium">Screenshot Detected</Label>
                      <p className="text-xs text-muted-foreground">
                        Burn when screenshots are detected
                      </p>
                    </div>
                    <Switch
                      checked={config.triggers.screenshot_detected.enabled}
                      onCheckedChange={(checked) =>
                        updateTrigger('screenshot_detected', { enabled: checked })
                      }
                    />
                  </div>
                  {config.triggers.screenshot_detected.enabled && (
                    <div>
                      <Label className="text-xs">Threshold</Label>
                      <Input
                        type="number"
                        min="1"
                        value={config.triggers.screenshot_detected.threshold}
                        onChange={(e) =>
                          updateTrigger('screenshot_detected', {
                            threshold: parseInt(e.target.value)
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  )}
                </Card>

                {/* Geofence Violations */}
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Label className="font-medium">Geofence Violations</Label>
                      <p className="text-xs text-muted-foreground">
                        Burn when access from restricted locations
                      </p>
                    </div>
                    <Switch
                      checked={config.triggers.geofence_violations.enabled}
                      onCheckedChange={(checked) =>
                        updateTrigger('geofence_violations', { enabled: checked })
                      }
                    />
                  </div>
                  {config.triggers.geofence_violations.enabled && (
                    <div>
                      <Label className="text-xs">Threshold</Label>
                      <Input
                        type="number"
                        min="1"
                        value={config.triggers.geofence_violations.threshold}
                        onChange={(e) =>
                          updateTrigger('geofence_violations', {
                            threshold: parseInt(e.target.value)
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  )}
                </Card>

                {/* Time Expired */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Time Expired</Label>
                      <p className="text-xs text-muted-foreground">
                        Auto-burn on expiration date
                      </p>
                    </div>
                    <Switch
                      checked={config.triggers.time_expired.enabled}
                      onCheckedChange={(checked) =>
                        updateTrigger('time_expired', { enabled: checked })
                      }
                    />
                  </div>
                </Card>

                {/* Suspicious Activity */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-medium">Suspicious Activity</Label>
                      <p className="text-xs text-muted-foreground">
                        Burn on honeypot triggers or bot detection
                      </p>
                    </div>
                    <Switch
                      checked={config.triggers.suspicious_activity.enabled}
                      onCheckedChange={(checked) =>
                        updateTrigger('suspicious_activity', { enabled: checked })
                      }
                    />
                  </div>
                </Card>
              </div>

              <Separator />

              {/* Post-Burn Actions */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Post-Burn Actions</Label>

                <div className="flex items-center justify-between">
                  <Label htmlFor="notify">Send Notification on Burn</Label>
                  <Switch
                    id="notify"
                    checked={config.notify_on_burn}
                    onCheckedChange={(checked) => updateConfig({ notify_on_burn: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="regen">Auto-Regenerate Menu</Label>
                  <Switch
                    id="regen"
                    checked={config.auto_regenerate}
                    onCheckedChange={(checked) => updateConfig({ auto_regenerate: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="migrate">Migrate Customers to New Menu</Label>
                  <Switch
                    id="migrate"
                    checked={config.migrate_customers}
                    onCheckedChange={(checked) => updateConfig({ migrate_customers: checked })}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {config.enabled && (
        <Card className="p-4 bg-destructive/5 border-destructive/20">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-destructive mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-medium text-destructive">Security Notice</p>
              <p className="text-muted-foreground">
                Auto-burn is a powerful security feature. Test thoroughly before enabling in production.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
