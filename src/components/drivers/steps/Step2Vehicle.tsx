import { useMemo } from 'react';
import { Car, Truck, Bike } from 'lucide-react';

import type { AddDriverForm } from '@/components/drivers/AddDriverDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ---------------------------------------------------------------------------
// Vehicle type cards
// ---------------------------------------------------------------------------

const VEHICLE_TYPES = [
  { value: 'car', label: 'Car', icon: Car },
  { value: 'van', label: 'Van', icon: Truck },
  { value: 'motorcycle', label: 'Motorcycle', icon: Bike },
  { value: 'bicycle', label: 'Bicycle', icon: Bike },
  { value: 'truck', label: 'Truck', icon: Truck },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COLOR_SWATCHES: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  silver: '#C0C0C0',
  gray: '#808080',
  red: '#EF4444',
  blue: '#3B82F6',
  green: '#22C55E',
  yellow: '#EAB308',
  orange: '#F97316',
  brown: '#92400E',
  navy: '#1E3A5F',
  beige: '#D2B48C',
};

function getColorSwatch(color: string): string | null {
  const lower = color.toLowerCase().trim();
  return COLOR_SWATCHES[lower] ?? null;
}

// Insurance tracking not yet in database — helper kept for future use

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Step2VehicleProps {
  form: AddDriverForm;
}

export function Step2Vehicle({ form }: Step2VehicleProps) {
  const { register, watch, setValue, formState: { errors } } = form;
  const vehicleType = watch('vehicle_type');
  const vehicleColor = watch('vehicle_color');

  const colorSwatch = useMemo(() => getColorSwatch(vehicleColor ?? ''), [vehicleColor]);

  return (
    <div className="space-y-5">
      {/* Vehicle Type Cards */}
      <div>
        <Label className="mb-2 text-sm text-muted-foreground">Vehicle Type</Label>
        <div className="grid grid-cols-5 gap-2">
          {VEHICLE_TYPES.map(({ value, label, icon: Icon }) => {
            const isSelected = vehicleType === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setValue('vehicle_type', value, { shouldValidate: true })}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Make + Model */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 text-sm text-muted-foreground" required>
            Make
          </Label>
          <Input
            {...register('vehicle_make')}
            placeholder="Toyota"
            error={!!errors.vehicle_make}
            className="h-10 min-h-0 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
          />
          {errors.vehicle_make && (
            <p className="mt-1 text-xs text-destructive">{errors.vehicle_make.message}</p>
          )}
        </div>
        <div>
          <Label className="mb-1.5 text-sm text-muted-foreground" required>
            Model
          </Label>
          <Input
            {...register('vehicle_model')}
            placeholder="Camry"
            error={!!errors.vehicle_model}
            className="h-10 min-h-0 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
          />
          {errors.vehicle_model && (
            <p className="mt-1 text-xs text-destructive">{errors.vehicle_model.message}</p>
          )}
        </div>
      </div>

      {/* Year + Color */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 text-sm text-muted-foreground" required>
            Year
          </Label>
          <Input
            {...register('vehicle_year')}
            type="number"
            placeholder="2023"
            min={1990}
            max={2030}
            error={!!errors.vehicle_year}
            className="h-10 min-h-0 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
          />
          {errors.vehicle_year && (
            <p className="mt-1 text-xs text-destructive">{errors.vehicle_year.message}</p>
          )}
        </div>
        <div>
          <Label className="mb-1.5 text-sm text-muted-foreground" required>
            Color
          </Label>
          <div className="relative">
            {colorSwatch && (
              <div
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-sm border border-muted-foreground"
                style={{ backgroundColor: colorSwatch }}
              />
            )}
            <Input
              {...register('vehicle_color')}
              placeholder="Black"
              error={!!errors.vehicle_color}
              className={`h-10 min-h-0 border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500 ${
                colorSwatch ? 'pl-9' : ''
              }`}
            />
          </div>
          {errors.vehicle_color && (
            <p className="mt-1 text-xs text-destructive">{errors.vehicle_color.message}</p>
          )}
        </div>
      </div>

      {/* License Plate */}
      <div>
        <Label className="mb-1.5 text-sm text-muted-foreground" required>
          License Plate
        </Label>
        <Input
          {...register('vehicle_plate')}
          placeholder="ABC-1234"
          error={!!errors.vehicle_plate}
          className="h-10 min-h-0 border-border bg-card text-sm uppercase text-foreground placeholder:normal-case placeholder:text-muted-foreground focus-visible:ring-emerald-500"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Format: AAA-0000 or AAA 0000</p>
        {errors.vehicle_plate && (
          <p className="mt-0.5 text-xs text-destructive">{errors.vehicle_plate.message}</p>
        )}
      </div>

    </div>
  );
}
