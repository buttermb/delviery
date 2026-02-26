/**
 * Enhanced Price Slider with dual handles and input fields
 */

import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface EnhancedPriceSliderProps {
  min?: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  step?: number;
  className?: string;
  accentColor?: string;
}

export function EnhancedPriceSlider({
  min = 0,
  max,
  value,
  onChange,
  step = 5,
  className,
  accentColor,
}: EnhancedPriceSliderProps) {
  const [localMin, setLocalMin] = useState(value[0].toString());
  const [localMax, setLocalMax] = useState(value[1].toString());

  // Sync local state with props
  useEffect(() => {
    setLocalMin(value[0].toString());
    setLocalMax(value[1].toString());
  }, [value]);

  const handleSliderChange = (newValue: number[]) => {
    onChange([newValue[0], newValue[1]]);
  };

  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalMin(e.target.value);
  };

  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalMax(e.target.value);
  };

  const handleMinBlur = () => {
    const numValue = parseInt(localMin) || min;
    const clampedValue = Math.max(min, Math.min(numValue, value[1] - step));
    setLocalMin(clampedValue.toString());
    onChange([clampedValue, value[1]]);
  };

  const handleMaxBlur = () => {
    const numValue = parseInt(localMax) || max;
    const clampedValue = Math.min(max, Math.max(numValue, value[0] + step));
    setLocalMax(clampedValue.toString());
    onChange([value[0], clampedValue]);
  };

  const handleKeyDown = (e: React.KeyboardEvent, isMin: boolean) => {
    if (e.key === 'Enter') {
      if (isMin) { handleMinBlur(); } else { handleMaxBlur(); }
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Slider */}
      <div className="relative pt-2">
        <Slider
          value={value}
          onValueChange={handleSliderChange}
          min={min}
          max={max}
          step={step}
          className="w-full"
          style={
            accentColor
              ? ({ '--slider-accent': accentColor } as React.CSSProperties)
              : undefined
          }
        />
        
        {/* Range indicator */}
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>${min}</span>
          <span>${max}</span>
        </div>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="price-min" className="text-xs text-muted-foreground">
            Min Price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              id="price-min"
              type="number"
              value={localMin}
              onChange={handleMinInputChange}
              onBlur={handleMinBlur}
              onKeyDown={(e) => handleKeyDown(e, true)}
              min={min}
              max={value[1] - step}
              className="pl-6 h-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="price-max" className="text-xs text-muted-foreground">
            Max Price
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              id="price-max"
              type="number"
              value={localMax}
              onChange={handleMaxInputChange}
              onBlur={handleMaxBlur}
              onKeyDown={(e) => handleKeyDown(e, false)}
              min={value[0] + step}
              max={max}
              className="pl-6 h-9"
            />
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Under $25', range: [0, 25] as [number, number] },
          { label: '$25-50', range: [25, 50] as [number, number] },
          { label: '$50-100', range: [50, 100] as [number, number] },
          { label: 'Over $100', range: [100, max] as [number, number] },
        ].filter(preset => preset.range[1] <= max || preset.range[0] < max).map((preset) => (
          <button
            key={preset.label}
            onClick={() => onChange(preset.range)}
            className={cn(
              "px-2 py-1 text-xs rounded-full border transition-colors",
              value[0] === preset.range[0] && value[1] === preset.range[1]
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted border-border"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default EnhancedPriceSlider;
