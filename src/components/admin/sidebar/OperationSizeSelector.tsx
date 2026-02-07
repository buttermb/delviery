/**
 * Operation Size Selector Component
 * 
 * Allows users to manually override auto-detected operation size
 */

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { useOperationSize } from '@/hooks/useOperationSize';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Info, AlertCircle } from 'lucide-react';
import type { OperationSize } from '@/types/sidebar';
import { Alert, AlertDescription } from '@/components/ui/alert';

const SIZE_LABELS: Record<OperationSize, string> = {
  street: 'Street (Solo Runner)',
  small: 'Small Business',
  medium: 'Medium Business',
  enterprise: 'Enterprise',
};

const SIZE_DESCRIPTIONS: Record<OperationSize, string> = {
  street: '<50 orders/month, ≤2 team members, 1 location',
  small: '<200 orders/month, ≤5 team members, ≤2 locations',
  medium: '<1000 orders/month, ≤20 team members, ≤5 locations',
  enterprise: '1000+ orders/month, 20+ team members, 5+ locations',
};

export function OperationSizeSelector() {
  const {
    operationSize,
    detectedSize,
    isAutoDetected,
    setOperationSize,
    resetToAuto,
    isLoading,
  } = useOperationSize();


  const { preferences } = useSidebarPreferences();
  const currentPreset = preferences?.layoutPreset || 'default';
  const isPresetOverriding = currentPreset !== 'default';

  const handleSizeChange = (value: string) => {
    setOperationSize(value as OperationSize);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">Operation Size</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your sidebar layout based on your operation size. The system auto-detects your size, but you can override it.
        </p>
      </div>

      {isAutoDetected && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <Badge variant="secondary">Auto-detected</Badge>
          <span className="text-sm text-muted-foreground">
            Currently using: <strong>{SIZE_LABELS[detectedSize]}</strong>
          </span>
        </div>
      )}

      {isPresetOverriding && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your selected layout preset <strong>"{currentPreset.replace('_', ' ')}"</strong> overrides operation size settings.
            Switch to "Default" preset to use operation-based sidebar layout.
          </AlertDescription>
        </Alert>
      )}

      <RadioGroup
        value={operationSize}
        onValueChange={handleSizeChange}
        disabled={isLoading}
      >
        {(Object.keys(SIZE_LABELS) as OperationSize[]).map((size) => (
          <div key={size} className="flex items-start space-x-2 space-y-0">
            <RadioGroupItem value={size} id={size} className="mt-1" />
            <div className="flex-1">
              <Label
                htmlFor={size}
                className="font-medium cursor-pointer"
              >
                {SIZE_LABELS[size]}
              </Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                {SIZE_DESCRIPTIONS[size]}
              </p>
            </div>
            {size === detectedSize && isAutoDetected && (
              <Badge variant="outline" className="ml-auto">
                Detected
              </Badge>
            )}
          </div>
        ))}
      </RadioGroup>

      {!isAutoDetected && (
        <Button
          variant="outline"
          size="sm"
          onClick={resetToAuto}
          disabled={isLoading}
          className="w-full"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Auto-Detected ({SIZE_LABELS[detectedSize]})
        </Button>
      )}
    </div>
  );
}

