import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { MultiCheckbox, type CheckboxOption } from '@/components/ui/multi-checkbox';
import { Download, Loader2 } from 'lucide-react';

export interface ExportField {
  value: string;
  label: string;
  description: string;
  recommended?: boolean;
}

interface ExportOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (selectedFields: string[]) => void;
  fields: ExportField[];
  title?: string;
  description?: string;
  isExporting?: boolean;
  itemCount?: number;
}

export function ExportOptionsDialog({
  open,
  onOpenChange,
  onExport,
  fields,
  title = 'Export Options',
  description = 'Select which related data to include in the export.',
  isExporting = false,
  itemCount,
}: ExportOptionsDialogProps) {
  const [selectedFields, setSelectedFields] = useState<string[]>(() =>
    fields.filter(f => f.recommended).map(f => f.value)
  );

  const options: CheckboxOption[] = fields.map(field => ({
    value: field.value,
    label: field.label,
    description: field.description,
    recommended: field.recommended,
  }));

  const handleExport = useCallback(() => {
    onExport(selectedFields);
  }, [onExport, selectedFields]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
            {itemCount !== undefined && (
              <span className="block mt-1 text-xs">
                {itemCount} {itemCount === 1 ? 'record' : 'records'} will be exported.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); handleExport(); }}>
          <div className="py-2">
            <MultiCheckbox
              options={options}
              value={selectedFields}
              onChange={setSelectedFields}
              label="Include Related Data"
              showSelectAll
              showCount
              showRecommended
              columns={1}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
