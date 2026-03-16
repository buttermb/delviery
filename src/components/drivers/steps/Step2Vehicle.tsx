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

function getInsuranceWarning(dateStr: string): { text: string; color: string } | null {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: 'Expired', color: '#EF4444' };
  }
  if (diffDays <= 30) {
    return { text: `Expiring in ${diffDays} day${diffDays !== 1 ? 's' : ''}`, color: '#F59E0B' };
  }
  return null;
}

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
  const insuranceExpiry = watch('insurance_expiry');

  const colorSwatch = useMemo(() => getColorSwatch(vehicleColor ?? ''), [vehicleColor]);
  const insuranceWarning = useMemo(
    () => getInsuranceWarning(insuranceExpiry ?? ''),
    [insuranceExpiry],
  );

  return (
    <div className="space-y-5">
      {/* Vehicle Type Cards */}
      <div>
        <Label className="mb-2 text-sm text-[#94A3B8]">Vehicle Type</Label>
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
                    ? 'border-[#10B981] bg-[#10B981]/10 text-[#10B981]'
                    : 'border-[#334155] bg-[#1E293B] text-[#64748B] hover:border-[#475569] hover:text-[#94A3B8]'
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
          <Label className="mb-1.5 text-sm text-[#94A3B8]" required>
            Make
          </Label>
          <Input
            {...register('vehicle_make')}
            placeholder="Toyota"
            error={!!errors.vehicle_make}
            className="h-10 min-h-0 border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
          />
          {errors.vehicle_make && (
            <p className="mt-1 text-xs text-[#EF4444]">{errors.vehicle_make.message}</p>
          )}
        </div>
        <div>
          <Label className="mb-1.5 text-sm text-[#94A3B8]" required>
            Model
          </Label>
          <Input
            {...register('vehicle_model')}
            placeholder="Camry"
            error={!!errors.vehicle_model}
            className="h-10 min-h-0 border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
          />
          {errors.vehicle_model && (
            <p className="mt-1 text-xs text-[#EF4444]">{errors.vehicle_model.message}</p>
          )}
        </div>
      </div>

      {/* Year + Color */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 text-sm text-[#94A3B8]" required>
            Year
          </Label>
          <Input
            {...register('vehicle_year')}
            type="number"
            placeholder="2023"
            min={1990}
            max={2030}
            error={!!errors.vehicle_year}
            className="h-10 min-h-0 border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981]"
          />
          {errors.vehicle_year && (
            <p className="mt-1 text-xs text-[#EF4444]">{errors.vehicle_year.message}</p>
          )}
        </div>
        <div>
          <Label className="mb-1.5 text-sm text-[#94A3B8]" required>
            Color
          </Label>
          <div className="relative">
            {colorSwatch && (
              <div
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-sm border border-[#475569]"
                style={{ backgroundColor: colorSwatch }}
              />
            )}
            <Input
              {...register('vehicle_color')}
              placeholder="Black"
              error={!!errors.vehicle_color}
              className={`h-10 min-h-0 border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] placeholder:text-[#475569] focus-visible:ring-[#10B981] ${
                colorSwatch ? 'pl-9' : ''
              }`}
            />
          </div>
          {errors.vehicle_color && (
            <p className="mt-1 text-xs text-[#EF4444]">{errors.vehicle_color.message}</p>
          )}
        </div>
      </div>

      {/* License Plate */}
      <div>
        <Label className="mb-1.5 text-sm text-[#94A3B8]" required>
          License Plate
        </Label>
        <Input
          {...register('vehicle_plate')}
          placeholder="ABC-1234"
          error={!!errors.vehicle_plate}
          className="h-10 min-h-0 border-[#334155] bg-[#1E293B] text-sm uppercase text-[#F8FAFC] placeholder:normal-case placeholder:text-[#475569] focus-visible:ring-[#10B981]"
        />
        <p className="mt-1 text-[11px] text-[#64748B]">Format: AAA-0000 or AAA 0000</p>
        {errors.vehicle_plate && (
          <p className="mt-0.5 text-xs text-[#EF4444]">{errors.vehicle_plate.message}</p>
        )}
      </div>

      {/* Insurance Expiry */}
      <div>
        <Label className="mb-1.5 text-sm text-[#94A3B8]">
          Insurance Expiry
        </Label>
        <Input
          {...register('insurance_expiry')}
          type="date"
          className="h-10 min-h-0 border-[#334155] bg-[#1E293B] text-sm text-[#F8FAFC] focus-visible:ring-[#10B981] [&::-webkit-calendar-picker-indicator]:invert"
        />
        {insuranceWarning && (
          <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: insuranceWarning.color }}>
            {insuranceWarning.color === '#F59E0B' && (
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            )}
            {insuranceWarning.text}
          </p>
        )}
      </div>
    </div>
  );
}
