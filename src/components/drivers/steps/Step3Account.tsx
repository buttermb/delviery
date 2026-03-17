import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, Eye, EyeOff, Copy, Check, MapPin } from 'lucide-react';

import type { AddDriverForm } from '@/components/drivers/AddDriverDialog';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMMISSION_TICKS = [10, 20, 30, 40, 50];
/** Derived at render time so it works on any deploy domain. */
function getPortalUrl() {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/courier`;
  }
  return '/courier';
}

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
  const driverName = watch('full_name');
  const driverEmail = watch('email');

  const { tenantSlug } = useTenantAdminAuth();
  const [pinVisible, setPinVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);

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

  const portalUrl = getPortalUrl();

  const handleCopyUrl = useCallback(async () => {
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [portalUrl]);

  const pinDigits = previewPin.split('');

  return (
    <div className="space-y-5">
      {/* Commission Rate */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Commission Rate</Label>
          <span className="font-['Space_Grotesk'] text-lg font-bold text-emerald-500">
            {commissionRate}%
          </span>
        </div>
        <Slider
          min={0}
          max={50}
          step={5}
          value={[commissionRate]}
          onValueChange={([val]) => setValue('commission_rate', val)}
          className="[&_[data-radix-slider-range]]:bg-emerald-500 [&_[data-radix-slider-thumb]]:border-emerald-500 [&_[data-radix-slider-thumb]]:bg-background [&_[data-radix-slider-track]]:bg-muted"
        />
        <div className="mt-1.5 flex justify-between px-0.5">
          {COMMISSION_TICKS.map((tick) => (
            <span key={tick} className="text-[10px] text-muted-foreground">
              {tick}%
            </span>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Driver earns {commissionRate}% per delivery
        </p>
      </div>

      {/* Assign Zone */}
      <div>
        <Label className="mb-1.5 text-sm text-muted-foreground">Assign Zone</Label>
        <div className="rounded-lg border border-border bg-card">
          <div className="max-h-[140px] overflow-y-auto">
            {zones.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-4 text-center">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">No delivery zones yet</p>
                <Link
                  to={`/${tenantSlug}/admin/delivery-zones`}
                  className="text-xs font-medium text-emerald-500 hover:underline"
                  target="_blank"
                >
                  Set up delivery zones
                </Link>
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
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="text-sm">{zone.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-emerald-500" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Driver PIN */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Driver PIN</Label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRegeneratePin}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Regenerate PIN"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPinVisible((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
              className="font-['JetBrains_Mono'] text-2xl font-bold text-foreground"
            >
              {pinVisible ? digit : '\u2022'}
            </span>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Driver uses this PIN to log into the courier portal
        </p>
      </div>

      {/* Login URL */}
      <div>
        <Label className="mb-1.5 text-sm text-muted-foreground">Login URL</Label>
        <div className="flex items-center gap-2">
          <div className="flex h-10 flex-1 items-center rounded-md border border-border bg-card px-3">
            <span className="truncate font-['JetBrains_Mono'] text-xs text-muted-foreground">
              {portalUrl}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="flex h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs text-emerald-500">Copied!</span>
              </>
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Send welcome email */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-foreground">Send welcome email</span>
          <button
            type="button"
            onClick={() => setEmailPreviewOpen(true)}
            className="self-start text-[11px] text-emerald-500 hover:underline"
          >
            Preview email
          </button>
        </div>
        <Switch
          checked={sendInviteEmail}
          onCheckedChange={(checked) => setValue('send_invite_email', checked)}
          className="data-[state=checked]:bg-emerald-500"
        />
      </div>
      {/* Email preview dialog */}
      <Dialog open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen}>
        <DialogContent className="max-w-[600px] border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Welcome Email Preview</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-white p-0">
            <div
              style={{
                fontFamily: 'Inter, -apple-system, sans-serif',
                maxWidth: 560,
                margin: '0 auto',
                padding: '40px 24px',
                color: '#1a1a1a',
              }}
            >
              <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Welcome to FloraIQ</h1>
              <p style={{ color: '#6b7280', marginBottom: 32 }}>
                Your driver account has been created. Use the credentials below to log in.
              </p>
              <div
                style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 20,
                  marginBottom: 24,
                }}
              >
                <p style={{ margin: '0 0 12px 0' }}>
                  <strong>Portal:</strong>{' '}
                  <span style={{ color: '#10b981' }}>{portalUrl}</span>
                </p>
                <p style={{ margin: '0 0 12px 0' }}>
                  <strong>Email:</strong> {driverEmail || 'driver@example.com'}
                </p>
                <p style={{ margin: '0 0 12px 0' }}>
                  <strong>Temporary Password:</strong>{' '}
                  <code
                    style={{
                      background: '#e5e7eb',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    ••••••••••••
                  </code>
                </p>
                <p style={{ margin: 0 }}>
                  <strong>PIN:</strong>{' '}
                  <code
                    style={{
                      background: '#e5e7eb',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    {previewPin}
                  </code>
                </p>
              </div>
              <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 24 }}>
                Please change your password after your first login. Your PIN is required for order
                verification.
              </p>
              <span
                style={{
                  display: 'inline-block',
                  background: '#10b981',
                  color: '#fff',
                  textDecoration: 'none',
                  padding: '12px 24px',
                  borderRadius: 6,
                  fontWeight: 500,
                }}
              >
                Open Courier Portal
              </span>
              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid #e5e7eb',
                  margin: '32px 0',
                }}
              />
              <p style={{ color: '#9ca3af', fontSize: 12 }}>
                This is an automated message from FloraIQ. Do not reply to this email.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
