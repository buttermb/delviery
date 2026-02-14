import React from 'react';
import { cn } from '@/lib/utils';

type WeightUnit = 'lb' | 'oz' | 'g' | 'kg';
type VolumeUnit = 'ml' | 'l' | 'fl_oz' | 'gal';
type CountUnit = 'each' | 'dozen' | 'case';

type Unit = WeightUnit | VolumeUnit | CountUnit;

interface ConversionFactors {
  [key: string]: number;
}

// Conversion factors to base unit (grams for weight, ml for volume, each for count)
const weightToGrams: ConversionFactors = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

const volumeToMl: ConversionFactors = {
  ml: 1,
  l: 1000,
  fl_oz: 29.5735,
  gal: 3785.41,
};

const countToEach: ConversionFactors = {
  each: 1,
  dozen: 12,
  case: 24, // Default case size, could be configurable
};

interface UnitConversionDisplayProps {
  /** The value to convert */
  value: number;
  /** The unit of the value */
  unit: Unit;
  /** Which units to show conversions for */
  showUnits?: Unit[];
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class names */
  className?: string;
  /** Show all conversions or just primary */
  showAll?: boolean;
}

function getUnitType(unit: Unit): 'weight' | 'volume' | 'count' {
  if (unit in weightToGrams) return 'weight';
  if (unit in volumeToMl) return 'volume';
  return 'count';
}

function convert(value: number, fromUnit: Unit, toUnit: Unit): number | null {
  const fromType = getUnitType(fromUnit);
  const toType = getUnitType(toUnit);
  
  if (fromType !== toType) return null;
  
  let factors: ConversionFactors;
  switch (fromType) {
    case 'weight':
      factors = weightToGrams;
      break;
    case 'volume':
      factors = volumeToMl;
      break;
    case 'count':
      factors = countToEach;
      break;
  }
  
  const baseValue = value * factors[fromUnit];
  return baseValue / factors[toUnit];
}

function formatValue(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (value >= 100) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  if (value >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

const unitLabels: Record<Unit, string> = {
  lb: 'lbs',
  oz: 'oz',
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'L',
  fl_oz: 'fl oz',
  gal: 'gal',
  each: 'ea',
  dozen: 'dz',
  case: 'cs',
};

const defaultConversions: Record<string, Unit[]> = {
  weight: ['lb', 'oz', 'g', 'kg'],
  volume: ['ml', 'l', 'fl_oz'],
  count: ['each', 'dozen'],
};

export function UnitConversionDisplay({
  value,
  unit,
  showUnits,
  size = 'sm',
  className,
  showAll = false,
}: UnitConversionDisplayProps) {
  const unitType = getUnitType(unit);
  const unitsToShow = showUnits || defaultConversions[unitType] || [];
  
  // Filter out the current unit
  const otherUnits = unitsToShow.filter((u) => u !== unit);
  
  // Get conversions
  const conversions = otherUnits
    .map((targetUnit) => ({
      unit: targetUnit,
      value: convert(value, unit, targetUnit),
    }))
    .filter((c): c is { unit: Unit; value: number } => c.value !== null);

  // Show only first 2 conversions unless showAll
  const displayConversions = showAll ? conversions : conversions.slice(0, 2);

  if (displayConversions.length === 0) return null;

  return (
    <span
      className={cn(
        'text-muted-foreground',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className
      )}
    >
      = {displayConversions.map((c, i) => (
        <React.Fragment key={c.unit}>
          {i > 0 && ' | '}
          {formatValue(c.value)} {unitLabels[c.unit]}
        </React.Fragment>
      ))}
    </span>
  );
}

interface WeightInputWithConversionProps {
  value: number;
  unit: WeightUnit;
  onChange?: (value: number, unit: WeightUnit) => void;
  showConversions?: boolean;
  className?: string;
}

export function WeightInputWithConversion({
  value,
  unit,
  showConversions = true,
  className,
}: WeightInputWithConversionProps) {
  if (!showConversions || !value) return null;

  return (
    <div className={cn('mt-1', className)}>
      <UnitConversionDisplay value={value} unit={unit} />
    </div>
  );
}

/**
 * Quick conversion utilities
 */
export const convertWeight = {
  lbToOz: (lb: number) => lb * 16,
  ozToLb: (oz: number) => oz / 16,
  lbToG: (lb: number) => lb * 453.592,
  gToLb: (g: number) => g / 453.592,
  lbToKg: (lb: number) => lb * 0.453592,
  kgToLb: (kg: number) => kg / 0.453592,
  ozToG: (oz: number) => oz * 28.3495,
  gToOz: (g: number) => g / 28.3495,
};

export const convertVolume = {
  mlToL: (ml: number) => ml / 1000,
  lToMl: (l: number) => l * 1000,
  flOzToMl: (flOz: number) => flOz * 29.5735,
  mlToFlOz: (ml: number) => ml / 29.5735,
  galToL: (gal: number) => gal * 3.78541,
  lToGal: (l: number) => l / 3.78541,
};
