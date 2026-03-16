import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Eye, EyeOff, Copy, Check } from 'lucide-react';

import type { AddDriverForm } from '@/components/drivers/AddDriverDialog';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMMISSION_TICKS = [10, 20, 30, 40, 50];
const PORTAL_URL = 'floraiq.app/courier';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Step3AccountProps {
  form: AddDriverForm;
  tenantId: string;
  previewPin: string;
  onRegeneratePin: () => void;
}

export function Step3Account({ form, tenantId, previewPin, onRegeneratePin }: Step3AccountProps) {
  const { watch, setValue } = form;
  const commissionRate = watch('commission_rate');
  const zoneId = watch('zone_id');
  const sendInviteEmail = watch('send_invite_email');

  const [pinVisible, setPinVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch zones
  const zonesQuery = useQuery({
    queryKey: [...queryKeys.delivery.zones(tenantId), 'add-driver'],
    queryFn: async () => {
      const { data } = await supabase
        .from('delivery_zones')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  const zones = zonesQuery.data ?? [];

  const handleCopyUrl = useCallback(async () => {
    await navigator.clipboard.writeText(`https://${PORTAL_URL}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const pinDigits = previewPin.split('');

  return (
    <div className="space-y-5">
      {/* Commission Rate */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm text-[#94A3B8]">Commission Rate</Label>
          <span className="font-['Space_Grotesk'] text-lg font-bold text-[#10B981]">
            {commissionRate}%
          </span>
        </div>
        <Slider
          min={0}
          max={50}
          step={5}
          value={[commissionRate]}
          onValueChange={([val]) => setValue('commission_rate', val)}
          className="[&_[data-radix-slider-range]]:bg-[#10B981] [&_[data-radix-slider-thumb]]:border-[#10B981] [&_[data-radix-slider-thumb]]:bg-[#0F172A] [&_[data-radix-slider-track]]:bg-[#334155]"
        />
        <div className="mt-1.5 flex justify-between px-0.5">
          {COMMISSION_TICKS.map((tick) => (
            <span key={tick} className="text-[10px] text-[#64748B]">
              {tick}%
            </span>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-[#64748B]">
          Driver earns {commissionRate}% per delivery
        </p>
      </div>

      {/* Assign Zone */}
      <div>
        <Label className="mb-1.5 text-sm text-[#94A3B8]">Assign Zone</Label>
        <div className="rounded-lg border border-[#334155] bg-[#1E293B]">
          <div className="max-h-[140px] overflow-y-auto">
            {zones.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[#64748B]">
                No zones available
              </div>
            ) : (
              zones.map((zone) => {
                const isSelected = zoneId === zone.id;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setValue('zone_id', isSelected ? '' : zone.id)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#10B981]/10 text-[#10B981]'
                        : 'text-[#F8FAFC] hover:bg-[#263548]'
                    }`}
                  >
                    <span className="text-sm">{zone.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-[#10B981]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Driver PIN */}
      <div className="rounded-lg border border-[#334155] bg-[#1E293B] p-4">
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm text-[#94A3B8]">Driver PIN</Label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRegeneratePin}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition-colors hover:bg-[#263548] hover:text-[#F8FAFC]"
              title="Regenerate PIN"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPinVisible((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#64748B] transition-colors hover:bg-[#263548] hover:text-[#F8FAFC]"
              title={pinVisible ? 'Hide PIN' : 'Show PIN'}
            >
              {pinVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 py-2">
          {pinDigits.map((digit, i) => (
            <span
              key={i}
              className="font-['JetBrains_Mono'] text-2xl font-bold text-[#F8FAFC]"
            >
              {pinVisible ? digit : '\u2022'}
            </span>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-[#64748B]">
          Driver uses this PIN to log into the courier portal
        </p>
      </div>

      {/* Login URL */}
      <div>
        <Label className="mb-1.5 text-sm text-[#94A3B8]">Login URL</Label>
        <div className="flex items-center gap-2">
          <div className="flex h-10 flex-1 items-center rounded-md border border-[#334155] bg-[#1E293B] px-3">
            <span className="truncate font-['JetBrains_Mono'] text-xs text-[#94A3B8]">
              {PORTAL_URL}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="flex h-10 items-center gap-1.5 rounded-md border border-[#334155] bg-[#1E293B] px-3 text-[#64748B] transition-colors hover:bg-[#263548] hover:text-[#F8FAFC]"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#10B981]" />
                <span className="text-xs text-[#10B981]">Copied!</span>
              </>
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Send welcome email */}
      <div className="flex items-center justify-between rounded-lg border border-[#334155] bg-[#1E293B] px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-[#F8FAFC]">Send welcome email</span>
          <button
            type="button"
            className="self-start text-[11px] text-[#10B981] hover:underline"
          >
            Preview email
          </button>
        </div>
        <Switch
          checked={sendInviteEmail}
          onCheckedChange={(checked) => setValue('send_invite_email', checked)}
          className="data-[state=checked]:bg-[#10B981]"
        />
      </div>
    </div>
  );
}
