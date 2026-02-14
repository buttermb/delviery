import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { History, RotateCcw, ChevronDown, ChevronUp, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { SettingsVersion } from '@/hooks/useSettingsVersions';

interface SettingsVersionHistoryProps {
  versions: SettingsVersion[];
  isLoading: boolean;
  onRestore: (version: SettingsVersion) => Promise<void>;
  isRestoring?: boolean;
  className?: string;
  /** Format field names for display */
  formatFieldName?: (field: string) => string;
}

export function SettingsVersionHistory({
  versions,
  isLoading,
  onRestore,
  isRestoring = false,
  className,
  formatFieldName = (field) => field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}: SettingsVersionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<SettingsVersion | null>(null);
  const [restoreVersion, setRestoreVersion] = useState<SettingsVersion | null>(null);

  const handleRestore = async () => {
    if (!restoreVersion) return;
    await onRestore(restoreVersion);
    setRestoreVersion(null);
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <History className="h-4 w-4" />
          <span className="text-sm font-medium">Version History</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className={cn('text-center py-6', className)}>
        <History className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">No version history yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Changes will appear here after saving
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-3 py-2 h-auto"
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Version History</span>
              <Badge variant="secondary" className="text-xs">
                {versions.length}
              </Badge>
            </div>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2">
          <div className="border rounded-lg divide-y">
            {versions.map((version, index) => (
              <VersionItem
                key={version.id}
                version={version}
                isLatest={index === 0}
                formatFieldName={formatFieldName}
                onPreview={() => setPreviewVersion(version)}
                onRestore={() => setRestoreVersion(version)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Preview Dialog */}
      <Dialog open={!!previewVersion} onOpenChange={() => setPreviewVersion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Version {previewVersion?.version_number} Preview
            </DialogTitle>
            <DialogDescription>
              Saved {previewVersion ? formatDistanceToNow(new Date(previewVersion.created_at), { addSuffix: true }) : ''}
              {previewVersion?.changed_by_email && (
                <> by {previewVersion.changed_by_email}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] mt-4">
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
              {JSON.stringify(previewVersion?.snapshot, null, 2)}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewVersion(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (previewVersion) {
                  setRestoreVersion(previewVersion);
                  setPreviewVersion(null);
                }
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore This Version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={!!restoreVersion} onOpenChange={() => setRestoreVersion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Settings?</DialogTitle>
            <DialogDescription>
              This will replace your current settings with version {restoreVersion?.version_number}
              {restoreVersion?.created_at && (
                <> from {format(new Date(restoreVersion.created_at), 'MMM d, yyyy h:mm a')}</>
              )}.
              Your current settings will be saved as a new version before restoring.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreVersion(null)}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface VersionItemProps {
  version: SettingsVersion;
  isLatest: boolean;
  formatFieldName: (field: string) => string;
  onPreview: () => void;
  onRestore: () => void;
}

function VersionItem({
  version,
  isLatest,
  formatFieldName,
  onPreview,
  onRestore,
}: VersionItemProps) {
  const changedFields = version.changed_fields ?? [];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">
            v{version.version_number}
          </span>
          {isLatest && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              Current
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
          </span>
        </div>
        {version.changed_by_email && (
          <p className="text-xs text-muted-foreground mt-0.5">
            by {version.changed_by_email}
          </p>
        )}
        {changedFields.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {changedFields.slice(0, 3).map((field) => (
              <Badge
                key={field}
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-normal"
              >
                {formatFieldName(field)}
              </Badge>
            ))}
            {changedFields.length > 3 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-normal"
              >
                +{changedFields.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPreview}
          className="h-7 px-2"
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          <span className="hidden sm:inline">Preview</span>
        </Button>
        {!isLatest && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRestore}
            className="h-7 px-2"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Restore</span>
          </Button>
        )}
      </div>
    </div>
  );
}
