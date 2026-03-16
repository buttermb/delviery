import { Car, Settings, Check, AlertTriangle } from 'lucide-react';

import type { AddDriverForm } from '@/components/drivers/AddDriverDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Step4ReviewProps {
  form: AddDriverForm;
  previewPin: string;
  isSubmitting: boolean;
  isSuccess: boolean;
  onGoToStep: (step: number) => void;
}

export function Step4Review({ form, previewPin, isSubmitting, isSuccess, onGoToStep }: Step4ReviewProps) {
  const values = form.getValues();

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#10B981]/20">
          <Check className="h-7 w-7 text-[#10B981]" />
        </div>
        <h3 className="text-lg font-semibold text-[#F8FAFC]">Driver created!</h3>
        <p className="mt-1 text-sm text-[#64748B]">
          {values.display_name || values.full_name} has been added to your fleet.
        </p>
      </div>
    );
  }

  const initials = getInitials(values.full_name);
  const vehicleDesc = [
    values.vehicle_make,
    values.vehicle_model,
    values.vehicle_year,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-3">
      {/* Personal Info Card */}
      <ReviewCard
        icon={
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E293B] text-xs font-semibold text-[#94A3B8]">
            {initials}
          </div>
        }
        editStep={1}
        onEdit={() => onGoToStep(1)}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#F8FAFC]">
            {values.display_name || values.full_name}
          </p>
          <p className="truncate text-xs text-[#64748B]">{values.phone}</p>
          <p className="truncate text-xs text-[#64748B]">{values.email}</p>
        </div>
      </ReviewCard>

      {/* Vehicle Card */}
      <ReviewCard
        icon={
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E293B] text-[#94A3B8]">
            <Car className="h-4 w-4" />
          </div>
        }
        editStep={2}
        onEdit={() => onGoToStep(2)}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#F8FAFC]">
            {vehicleDesc}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-[#64748B]">
            <span>{values.vehicle_plate}</span>
            {values.vehicle_color && (
              <>
                <span className="text-[#475569]">/</span>
                <span>{values.vehicle_color}</span>
              </>
            )}
          </div>
        </div>
      </ReviewCard>

      {/* Account Card */}
      <ReviewCard
        icon={
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E293B] text-[#94A3B8]">
            <Settings className="h-4 w-4" />
          </div>
        }
        editStep={3}
        onEdit={() => onGoToStep(3)}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#10B981]/20 px-2 py-0.5 text-[11px] font-medium text-[#10B981]">
              {values.commission_rate}% commission
            </span>
            <span className="font-['JetBrains_Mono'] text-xs text-[#64748B]">
              PIN: {'\u2022'.repeat(6)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-[#64748B]">
            {values.send_invite_email && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-[#F59E0B]" />
                Invite email on
              </span>
            )}
          </div>
        </div>
      </ReviewCard>

      {/* Submit button */}
      {isSubmitting && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-[#94A3B8]">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Creating account...
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review Card
// ---------------------------------------------------------------------------

function ReviewCard({
  icon,
  editStep,
  onEdit,
  children,
}: {
  icon: React.ReactNode;
  editStep: number;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#334155] bg-[#1E293B] p-4">
      {icon}
      <div className="flex-1">{children}</div>
      <button
        type="button"
        onClick={onEdit}
        className="flex-shrink-0 text-xs text-[#10B981] hover:underline"
      >
        Edit
      </button>
    </div>
  );
}
