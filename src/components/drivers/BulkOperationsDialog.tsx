import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { read, utils } from 'xlsx';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { getCreditCost } from '@/lib/credits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreditGatedAction } from '@/hooks/useCreditGatedAction';
import { BulkCreditCalculator, useBulkCreditCalculator } from '@/components/credits/BulkCreditCalculator';
import { CreditCostBadge } from '@/components/credits/CreditCostBadge';
import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'import' | 'update' | 'export' | 'notify';
type ImportStep = 'upload' | 'map' | 'preview';

interface ParsedRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

const DB_FIELDS = [
  { value: 'full_name' as const, label: 'Full Name' },
  { value: 'email' as const, label: 'Email' },
  { value: 'phone' as const, label: 'Phone' },
  { value: 'vehicle_type' as const, label: 'Vehicle Type' },
  { value: 'vehicle_plate' as const, label: 'License Plate' },
  { value: 'zone_name' as const, label: 'Zone' },
  { value: '' as const, label: '— Skip —' },
] as const;

const UPDATE_FIELDS = [
  { value: 'status' as const, label: 'Status' },
  { value: 'zone_id' as const, label: 'Zone' },
  { value: 'commission_rate' as const, label: 'Commission Rate' },
  { value: 'vehicle_type' as const, label: 'Vehicle Type' },
] as const;

type UpdateFieldValue = (typeof UPDATE_FIELDS)[number]['value'];

const EXPORT_FORMATS = ['CSV', 'XLSX'] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BulkOperationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  selectedDriverIds?: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BulkOperationsDialog({
  open,
  onOpenChange,
  tenantId,
  selectedDriverIds = [],
}: BulkOperationsDialogProps) {
  const { token } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('import');

  useEffect(() => {
    if (open) {
      setTab('import');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground">Bulk Operations</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border -mx-4 sm:-mx-6 px-4 sm:px-6">
          {(['import', 'update', 'export', 'notify'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 pb-2.5 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'border-b-2 border-emerald-500 text-foreground'
                  : 'text-muted-foreground hover:text-muted-foreground'
              }`}
            >
              {t === 'notify' ? 'Notifications' : t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="min-h-[320px]">
          {tab === 'import' && (
            <ImportTab tenantId={tenantId} token={token} queryClient={queryClient} onClose={() => onOpenChange(false)} />
          )}
          {tab === 'update' && (
            <BulkUpdateTab
              tenantId={tenantId}
              selectedDriverIds={selectedDriverIds}
              queryClient={queryClient}
              onClose={() => onOpenChange(false)}
            />
          )}
          {tab === 'export' && <ExportTab tenantId={tenantId} />}
          {tab === 'notify' && (
            <NotifyTab
              tenantId={tenantId}
              selectedDriverIds={selectedDriverIds}
              token={token}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Import Tab
// ===========================================================================

function ImportTab({
  tenantId,
  token,
  queryClient,
  onClose,
}: {
  tenantId: string;
  token: string | null;
  queryClient: ReturnType<typeof useQueryClient>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = utils.sheet_to_json<ParsedRow>(sheet, { defval: '' });

        if (jsonRows.length === 0) {
          toast.error('File is empty');
          return;
        }

        const cols = Object.keys(jsonRows[0]);
        setRows(jsonRows);
        setCsvColumns(cols);
        setMappings(
          cols.map((c) => ({
            csvColumn: c,
            dbField: autoMapColumn(c),
          })),
        );
        setStep('map');
      } catch (err) {
        logger.error('Failed to parse file', err);
        toast.error('Failed to parse file');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const validMappings = useMemo(
    () => mappings.filter((m) => m.dbField),
    [mappings],
  );

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const { execute: executeCreditAction, showOutOfCreditsModal, closeOutOfCreditsModal, blockedAction } = useCreditGatedAction();

  const importMutation = useMutation({
    mutationFn: async () => {
      const ALLOWED_FIELDS = new Set<string>(DB_FIELDS.map((f) => f.value).filter(Boolean));

      const body = rows.map((row) => {
        const mapped: Record<string, string> = {};
        for (const m of validMappings) {
          if (!ALLOWED_FIELDS.has(m.dbField)) continue;
          mapped[m.dbField] = String(row[m.csvColumn] ?? '').trim().slice(0, 500);
        }
        return mapped;
      });

      const result = await executeCreditAction({
        actionKey: 'customer_import',
        action: async () => {
          const res = await supabase.functions.invoke('bulk-import-drivers', {
            body: { drivers: body },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          if (res.error) throw res.error;
          if (!res.data) throw new Error('Invalid response from server');
          return res.data as { imported: number; skipped: number };
        },
        referenceType: 'driver_import',
      });

      if (result.wasBlocked) {
        throw new Error('CREDIT_BLOCKED');
      }
      if (!result.success) {
        throw result.error ?? new Error('Import failed');
      }
      return result.result!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success(`Imported ${data.imported} drivers${data.skipped ? `, ${data.skipped} skipped` : ''}`);
      onClose();
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'CREDIT_BLOCKED') return;
      logger.error('Bulk import failed', err);
      toast.error('Bulk import failed');
    },
  });

  if (step === 'upload') {
    return (
      <div className="space-y-4 pt-2">
        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors ${
            dragOver
              ? 'border-emerald-500 bg-emerald-500/5'
              : 'border-border hover:border-muted-foreground'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <svg className="mb-3 h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-muted-foreground">
            Drag & drop a CSV or Excel file
          </p>
          <p className="mt-1 text-xs text-muted-foreground">or</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            className="mt-2 h-7 border-border bg-transparent text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Browse Files
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Accepted: .csv, .xlsx, .xls. Include columns for name, email, phone at minimum.
        </p>
      </div>
    );
  }

  if (step === 'map') {
    return (
      <div className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Map your file columns to driver fields. {rows.length} rows detected.
        </p>

        <div className="max-h-[240px] space-y-2 overflow-y-auto">
          {mappings.map((m, i) => (
            <div key={m.csvColumn} className="flex items-center gap-3">
              <span className="w-[140px] truncate text-xs text-foreground">{m.csvColumn}</span>
              <svg className="h-3 w-3 flex-shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <select
                value={m.dbField}
                onChange={(e) => {
                  setMappings((prev) => {
                    const next = [...prev];
                    next[i] = { ...m, dbField: e.target.value };
                    return next;
                  });
                }}
                className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {DB_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep('upload')}
            className="h-7 text-xs text-muted-foreground hover:text-muted-foreground"
          >
            Back
          </Button>
          <Button
            size="sm"
            onClick={() => setStep('preview')}
            disabled={validMappings.length === 0}
            className="h-7 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
          >
            Next: Preview
          </Button>
        </div>
      </div>
    );
  }

  // Preview step
  return (
    <div className="space-y-4 pt-2">
      <p className="text-sm text-muted-foreground">
        Previewing first {previewRows.length} of {rows.length} rows.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-background">
              {validMappings.map((m) => (
                <th key={m.dbField} className="px-3 py-2 text-left font-medium text-muted-foreground">
                  {DB_FIELDS.find((f) => f.value === m.dbField)?.label ?? m.dbField}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {validMappings.map((m) => (
                  <td key={m.dbField} className="px-3 py-2 text-muted-foreground">
                    {row[m.csvColumn] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep('map')}
          className="h-7 text-xs text-muted-foreground hover:text-muted-foreground"
        >
          Back
        </Button>
        <Button
          size="sm"
          onClick={() => importMutation.mutate()}
          disabled={importMutation.isPending}
          className="group h-7 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
        >
          {importMutation.isPending ? 'Importing...' : `Import ${rows.length} Drivers`}
          <CreditCostBadge actionKey="customer_import" compact className="ml-1" />
        </Button>
      </div>

      <OutOfCreditsModal
        open={showOutOfCreditsModal}
        onOpenChange={closeOutOfCreditsModal}
        actionAttempted={blockedAction ?? undefined}
      />
    </div>
  );
}

// ===========================================================================
// Bulk Update Tab
// ===========================================================================

function BulkUpdateTab({
  tenantId,
  selectedDriverIds,
  queryClient,
  onClose,
}: {
  tenantId: string;
  selectedDriverIds: string[];
  queryClient: ReturnType<typeof useQueryClient>;
  onClose: () => void;
}) {
  const [field, setField] = useState<UpdateFieldValue>(UPDATE_FIELDS[0].value);
  const [value, setValue] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const count = selectedDriverIds.length;

  const { execute: executeCreditAction, showOutOfCreditsModal, closeOutOfCreditsModal, blockedAction } = useCreditGatedAction();

  const updateMutation = useMutation({
    mutationFn: async () => {
      const result = await executeCreditAction({
        actionKey: 'stock_bulk_update',
        action: async () => {
          // Verify all selected drivers belong to this tenant
          const { data: validDrivers, error: checkError } = await supabase
            .from('couriers')
            .select('id')
            .in('id', selectedDriverIds)
            .eq('tenant_id', tenantId);
          if (checkError) throw checkError;
          if (validDrivers?.length !== selectedDriverIds.length) {
            throw new Error('One or more drivers do not belong to this tenant');
          }

          const updates: Record<string, unknown> = { [field]: value };

          const { error, count: updated } = await supabase
            .from('couriers')
            .update(updates, { count: 'exact' })
            .in('id', selectedDriverIds)
            .eq('tenant_id', tenantId);

          if (error) throw error;
          return updated ?? 0;
        },
        referenceType: 'driver_bulk_update',
      });

      if (result.wasBlocked) {
        throw new Error('CREDIT_BLOCKED');
      }
      if (!result.success) {
        throw result.error ?? new Error('Update failed');
      }
      return result.result!;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success(`Updated ${updated} drivers`);
      onClose();
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'CREDIT_BLOCKED') return;
      logger.error('Bulk update failed', err);
      toast.error('Bulk update failed');
    },
  });

  return (
    <div className="space-y-4 pt-2">
      {/* Target */}
      <div>
        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          Target
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {count > 0 ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
              {count} selected driver{count > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No drivers selected. Select drivers from the directory first.</span>
          )}
        </div>
      </div>

      {/* Field */}
      <div>
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          Field to Update
        </span>
        <select
          value={field}
          onChange={(e) => { setField(e.target.value as UpdateFieldValue); setValue(''); }}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {UPDATE_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Value */}
      <div>
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          New Value
        </span>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Enter new ${UPDATE_FIELDS.find((f) => f.value === field)?.label ?? field}...`}
          className="h-9 min-h-0 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-emerald-500"
        />
      </div>

      {/* Confirm */}
      {!confirmOpen ? (
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={count === 0 || !value.trim()}
          className="group h-8 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
        >
          Review Changes
          <CreditCostBadge actionKey="stock_bulk_update" compact className="ml-1" />
        </Button>
      ) : (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-foreground">
            Set <span className="font-medium">{UPDATE_FIELDS.find((f) => f.value === field)?.label}</span> to{' '}
            <span className="font-medium text-emerald-500">{value}</span> for{' '}
            <span className="font-medium">{count} driver{count > 1 ? 's' : ''}</span>?
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="group h-7 bg-amber-500 text-xs text-white hover:bg-amber-600"
            >
              {updateMutation.isPending ? 'Updating...' : 'Confirm Update'}
              <CreditCostBadge actionKey="stock_bulk_update" compact className="ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              className="h-7 text-xs text-muted-foreground hover:text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <OutOfCreditsModal
        open={showOutOfCreditsModal}
        onOpenChange={closeOutOfCreditsModal}
        actionAttempted={blockedAction ?? undefined}
      />
    </div>
  );
}

// ===========================================================================
// Export Tab
// ===========================================================================

function ExportTab({ tenantId }: { tenantId: string }) {
  const [format, setFormat] = useState<(typeof EXPORT_FORMATS)[number]>('CSV');
  const [includeOffline, setIncludeOffline] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      let query = supabase
        .from('couriers')
        .select('full_name, email, phone, status, is_online, vehicle_type, vehicle_plate, commission_rate, created_at')
        .eq('tenant_id', tenantId)
        .order('full_name');

      if (!includeOffline) {
        query = query.eq('is_online', true);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('No drivers to export');
        return;
      }

      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Drivers');

      if (format === 'CSV') {
        const csv = XLSX.utils.sheet_to_csv(ws);
        downloadBlob(new Blob([csv], { type: 'text/csv' }), 'drivers-export.csv');
      } else {
        XLSX.writeFile(wb, 'drivers-export.xlsx');
      }

      toast.success('Export complete');
    } catch (err) {
      logger.error('Export failed', err);
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, [tenantId, format, includeOffline]);

  return (
    <div className="space-y-4 pt-2">
      <p className="text-sm text-muted-foreground">Export your driver directory as a file.</p>

      {/* Format */}
      <div>
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          Format
        </span>
        <div className="flex gap-2">
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                format === f
                  ? 'bg-emerald-500 text-white'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-muted-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      <label className="flex items-center gap-2.5 cursor-pointer">
        <Checkbox
          checked={includeOffline}
          onCheckedChange={(v) => setIncludeOffline(v === true)}
          className="border-border data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
        />
        <span className="text-sm text-muted-foreground">Include offline drivers</span>
      </label>

      <Button
        onClick={handleExport}
        disabled={exporting}
        className="h-8 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
      >
        {exporting ? 'Exporting...' : `Export as ${format}`}
      </Button>
    </div>
  );
}

// ===========================================================================
// Notifications Tab
// ===========================================================================

/** Map notification channel to credit action key */
const CHANNEL_ACTION_KEYS: Record<string, string> = {
  email: 'send_bulk_email',
  sms: 'send_bulk_sms',
};

function NotifyTab({
  tenantId,
  selectedDriverIds,
  token,
  onClose,
}: {
  tenantId: string;
  selectedDriverIds: string[];
  token: string | null;
  onClose: () => void;
}) {
  const [channels, setChannels] = useState({ email: true, sms: false, push: false });
  const [message, setMessage] = useState('');

  const count = selectedDriverIds.length;
  const channelCount = Object.values(channels).filter(Boolean).length;
  const canSend = count > 0 && channelCount > 0 && message.trim().length > 0;

  const { execute: executeCreditAction, showOutOfCreditsModal, closeOutOfCreditsModal, blockedAction, isFreeTier } = useCreditGatedAction();

  // Build item breakdown for credit calculator based on selected channels
  const itemBreakdown = useMemo(() => {
    const breakdown: Array<{ label: string; count: number; actionKey: string }> = [];
    if (channels.email) {
      breakdown.push({ label: 'Email notifications', count, actionKey: 'send_bulk_email' });
    }
    if (channels.sms) {
      breakdown.push({ label: 'SMS notifications', count, actionKey: 'send_bulk_sms' });
    }
    // Push notifications have no credit cost
    return breakdown;
  }, [channels.email, channels.sms, count]);

  // Calculate estimated total cost for display
  const estimatedCost = useMemo(() => {
    let total = 0;
    if (channels.email) total += count * getCreditCost('send_bulk_email');
    if (channels.sms) total += count * getCreditCost('send_bulk_sms');
    return total;
  }, [channels.email, channels.sms, count]);

  // Determine the primary action key for the credit gate
  const primaryActionKey = useMemo(() => {
    if (channels.sms) return 'send_bulk_sms';
    if (channels.email) return 'send_bulk_email';
    return 'bulk_operation_execute'; // push-only is free
  }, [channels.email, channels.sms]);

  const doSend = useCallback(async () => {
    const res = await supabase.functions.invoke('bulk-notify-drivers', {
      body: {
        driver_ids: selectedDriverIds,
        channels: Object.entries(channels)
          .filter(([, v]) => v)
          .map(([k]) => k),
        message: message.trim(),
      },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (res.error) throw res.error;
    if (!res.data) throw new Error('Invalid response from server');
    return res.data as { sent: number };
  }, [selectedDriverIds, channels, message, token]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      // If no paid channels selected, just send directly
      if (estimatedCost === 0) {
        return doSend();
      }

      const result = await executeCreditAction({
        actionKey: primaryActionKey,
        action: doSend,
        referenceType: 'driver_bulk_notify',
      });

      if (result.wasBlocked) {
        throw new Error('CREDIT_BLOCKED');
      }
      if (!result.success) {
        throw result.error ?? new Error('Send failed');
      }
      return result.result!;
    },
    onSuccess: (data) => {
      toast.success(`Notification sent to ${data.sent} drivers`);
      onClose();
    },
    onError: (err) => {
      if (err instanceof Error && err.message === 'CREDIT_BLOCKED') return;
      logger.error('Bulk notify failed', err);
      toast.error('Failed to send notifications');
    },
  });

  const calculator = useBulkCreditCalculator({
    actionKey: primaryActionKey,
    itemCount: count,
    actionDescription: `Send notifications to ${count} driver${count !== 1 ? 's' : ''}`,
    itemBreakdown: itemBreakdown.length > 0 ? itemBreakdown : undefined,
    onConfirm: () => sendMutation.mutate(),
  });

  const handleSend = () => {
    // If no paid channels, send directly without credit calculator
    if (estimatedCost === 0) {
      sendMutation.mutate();
      return;
    }
    calculator.open();
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Target */}
      <div>
        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          Recipients
        </span>
        <div className="mt-1.5">
          {count > 0 ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
              {count} driver{count > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No drivers selected.</span>
          )}
        </div>
      </div>

      {/* Channels */}
      <div>
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          Channels
        </span>
        <div className="flex items-center gap-4">
          {(['email', 'sms', 'push'] as const).map((ch) => (
            <label key={ch} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={channels[ch]}
                onCheckedChange={(v) =>
                  setChannels((prev) => ({ ...prev, [ch]: v === true }))
                }
                className="border-border data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
              />
              <span className="text-sm capitalize text-muted-foreground">{ch}</span>
              {CHANNEL_ACTION_KEYS[ch] && (
                <CreditCostBadge actionKey={CHANNEL_ACTION_KEYS[ch]} compact showTooltip={false} />
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Estimated Cost */}
      {isFreeTier && estimatedCost > 0 && count > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Estimated cost: <strong className="text-foreground">{estimatedCost.toLocaleString()} credits</strong>
            {' '}({count} recipient{count !== 1 ? 's' : ''} &times;{' '}
            {itemBreakdown.map((b) => `${getCreditCost(b.actionKey)} cr/${b.label.split(' ')[0].toLowerCase()}`).join(' + ')})
          </span>
        </div>
      )}

      {/* Message */}
      <div>
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
          Message
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Write your notification message..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      <Button
        onClick={handleSend}
        disabled={!canSend || sendMutation.isPending}
        className="group h-8 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
      >
        {sendMutation.isPending ? 'Sending...' : `Send to ${count} Driver${count !== 1 ? 's' : ''}`}
        {estimatedCost > 0 && (
          <CreditCostBadge cost={estimatedCost} compact className="ml-1" />
        )}
      </Button>

      <BulkCreditCalculator {...calculator.calculatorProps} />

      <OutOfCreditsModal
        open={showOutOfCreditsModal}
        onOpenChange={closeOutOfCreditsModal}
        actionAttempted={blockedAction ?? undefined}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function autoMapColumn(csvCol: string): string {
  const lower = csvCol.toLowerCase().replace(/[^a-z]/g, '');
  if (lower.includes('name') || lower.includes('fullname')) return 'full_name';
  if (lower.includes('email')) return 'email';
  if (lower.includes('phone') || lower.includes('mobile')) return 'phone';
  if (lower.includes('vehicle') && lower.includes('type')) return 'vehicle_type';
  if (lower.includes('plate') || lower.includes('license')) return 'vehicle_plate';
  if (lower.includes('zone')) return 'zone_name';
  return '';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
