import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { generateQRCodeDataURL, downloadQRCodePNG } from '@/lib/utils/qrCode';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CourierPortalCardProps {
  onManagePins?: () => void;
  onBulkInvite?: () => void;
}

export function CourierPortalCard({ onManagePins, onBulkInvite }: CourierPortalCardProps) {
  const { tenant } = useTenantAdminAuth();
  const slug = tenant?.slug ?? tenant?.id ?? '';

  const portalUrl = `${window.location.origin}/${slug}/driver-portal`;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate QR code
  useEffect(() => {
    if (!portalUrl) return;
    let cancelled = false;

    generateQRCodeDataURL(portalUrl, {
      size: 200,
      margin: 2,
      color: { dark: '#F8FAFC', light: '#0F172A' },
    })
      .then((url) => {
        if (!cancelled && url.startsWith('data:image/')) setQrDataUrl(url);
      })
      .catch((err) => logger.error('Failed to generate QR code', err));

    return () => { cancelled = true; };
  }, [portalUrl]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      toast.success('Portal URL copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy URL');
    }
  }, [portalUrl]);

  const handleDownloadQR = useCallback(async () => {
    try {
      await downloadQRCodePNG(portalUrl, `${slug}-driver-portal-qr.png`, {
        size: 512,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });
      toast.success('QR code downloaded');
    } catch (err) {
      logger.error('Failed to download QR code', err);
      toast.error('Failed to download QR code');
    }
  }, [portalUrl, slug]);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Courier Portal</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Share this link with drivers so they can access their portal.
      </p>

      {/* Portal URL */}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-['JetBrains_Mono'] text-xs text-muted-foreground">
          {portalUrl}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="h-8 flex-shrink-0 border-border bg-transparent text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {copied ? (
            <svg className="mr-1 h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      {/* QR Code + Login Steps */}
      <div className="mt-5 flex gap-5">
        {/* QR Code */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-[140px] w-[140px] items-center justify-center rounded-lg border border-border bg-background p-2">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Driver portal QR code" className="h-full w-full" />
            ) : (
              <div className="h-full w-full animate-pulse rounded bg-muted" />
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadQR}
            className="h-6 text-[10px] text-muted-foreground hover:text-muted-foreground"
          >
            <svg className="mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download PNG
          </Button>
        </div>

        {/* Login flow */}
        <div className="flex-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Driver Login Flow
          </span>
          <div className="mt-2.5 space-y-3">
            <LoginStep
              number={1}
              title="Scan QR or visit URL"
              description="Driver opens the portal link on their phone"
            />
            <LoginStep
              number={2}
              title="Enter phone number"
              description="Matches their registered phone number"
            />
            <LoginStep
              number={3}
              title="Enter 6-digit PIN"
              description="Secure PIN assigned by admin"
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
        {onManagePins && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManagePins}
            className="h-8 border-border bg-transparent text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Manage PINs
          </Button>
        )}
        {onBulkInvite && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkInvite}
            className="h-8 border-border bg-transparent text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Bulk Invite
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoginStep({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-500">
        {number}
      </div>
      <div>
        <span className="text-xs font-medium text-foreground">{title}</span>
        <p className="text-[11px] leading-tight text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
