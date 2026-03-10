import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface StepExpirationProps {
  expirationHours: number;
  onExpirationHoursChange: (value: number) => void;
  maxViews: number;
  onMaxViewsChange: (value: number) => void;
  neverExpires: boolean;
  onNeverExpiresChange: (value: boolean) => void;
}

export function StepExpiration({
  expirationHours,
  onExpirationHoursChange,
  maxViews,
  onMaxViewsChange,
  neverExpires,
  onNeverExpiresChange,
}: StepExpirationProps) {
  return (
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
          <Switch checked={neverExpires} onCheckedChange={onNeverExpiresChange} />
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
              onChange={(e) => onExpirationHoursChange(parseInt(e.target.value))}
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
                onClick={() => onExpirationHoursChange(h)}
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
            onChange={(e) => onMaxViewsChange(parseInt(e.target.value))}
            className="flex-1"
          />
          <Input
            type="number"
            min={1}
            max={1000}
            value={maxViews}
            onChange={(e) =>
              onMaxViewsChange(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))
            }
            className="w-24"
          />
        </div>
      </div>
    </div>
  );
}
