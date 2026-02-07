/**
 * Version History Panel
 * Shows timeline of changes with view/restore capability
 */

import React, { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  History,
  Clock,
  User,
  Eye,
  RotateCcw,
  ChevronRight,
  FileText,
  Edit,
  Trash2,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface VersionEntry {
  id: string;
  timestamp: Date;
  userId?: string;
  userName?: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  changes?: Record<string, { before: unknown; after: unknown }>;
  snapshot?: Record<string, unknown>;
  description?: string;
}

interface VersionHistoryPanelProps {
  entityType: string;
  entityId: string;
  entityName?: string;
  versions: VersionEntry[];
  onRestore?: (version: VersionEntry) => Promise<void>;
  onView?: (version: VersionEntry) => void;
  isLoading?: boolean;
  trigger?: React.ReactNode;
  className?: string;
}

export function VersionHistoryPanel({
  entityType,
  entityId,
  entityName,
  versions,
  onRestore,
  onView,
  isLoading = false,
  trigger,
  className,
}: VersionHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<VersionEntry | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<VersionEntry | null>(null);

  const handleRestoreClick = (version: VersionEntry) => {
    setSelectedVersion(version);
    setRestoreDialogOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedVersion || !onRestore) return;

    setIsRestoring(true);
    try {
      await onRestore(selectedVersion);
      setRestoreDialogOpen(false);
      setOpen(false);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleViewClick = (version: VersionEntry) => {
    setPreviewVersion(version);
    onView?.(version);
  };

  const getActionIcon = (action: VersionEntry['action']) => {
    switch (action) {
      case 'create': return <Plus className="h-3.5 w-3.5" />;
      case 'update': return <Edit className="h-3.5 w-3.5" />;
      case 'delete': return <Trash2 className="h-3.5 w-3.5" />;
      case 'restore': return <RotateCcw className="h-3.5 w-3.5" />;
    }
  };

  const getActionColor = (action: VersionEntry['action']) => {
    switch (action) {
      case 'create': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'update': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'delete': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'restore': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    }
  };

  const getActionLabel = (action: VersionEntry['action']) => {
    switch (action) {
      case 'create': return 'Created';
      case 'update': return 'Updated';
      case 'delete': return 'Deleted';
      case 'restore': return 'Restored';
    }
  };

  const formatChanges = (changes: Record<string, { before: unknown; after: unknown }>) => {
    return Object.entries(changes).map(([field, { before, after }]) => ({
      field: field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      before: formatValue(before),
      after: formatValue(after),
    }));
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toLocaleString();
    if (value instanceof Date) return format(value, 'MMM d, yyyy');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className={className}>
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
          )}
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </SheetTitle>
            {entityName && (
              <p className="text-sm text-muted-foreground">
                {entityType}: {entityName}
              </p>
            )}
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)] mt-4 -mx-6 px-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                    <div className="h-20 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No version history available</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

                <div className="space-y-4">
                  {versions.map((version, index) => (
                    <div
                      key={version.id}
                      className={cn(
                        'relative pl-8 pb-4',
                        index === versions.length - 1 && 'pb-0'
                      )}
                    >
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center',
                          getActionColor(version.action)
                        )}
                      >
                        {getActionIcon(version.action)}
                      </div>

                      <div className="bg-card border rounded-lg p-3">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            variant="outline"
                            className={cn('text-xs', getActionColor(version.action))}
                          >
                            {getActionLabel(version.action)}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(version.timestamp, { addSuffix: true })}
                          </span>
                        </div>

                        {/* User info */}
                        {version.userName && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                            <User className="h-3 w-3" />
                            {version.userName}
                          </div>
                        )}

                        {/* Description */}
                        {version.description && (
                          <p className="text-sm text-foreground mb-2">
                            {version.description}
                          </p>
                        )}

                        {/* Changes */}
                        {version.changes && Object.keys(version.changes).length > 0 && (
                          <div className="space-y-1 mb-2">
                            {formatChanges(version.changes).slice(0, 3).map(change => (
                              <div key={change.field} className="text-xs">
                                <span className="text-muted-foreground">{change.field}:</span>
                                <span className="text-red-500 line-through ml-1">{change.before}</span>
                                <ChevronRight className="h-3 w-3 inline mx-1" />
                                <span className="text-green-600">{change.after}</span>
                              </div>
                            ))}
                            {Object.keys(version.changes).length > 3 && (
                              <p className="text-xs text-muted-foreground">
                                +{Object.keys(version.changes).length - 3} more changes
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 mt-2">
                          {version.snapshot && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleViewClick(version)}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          )}
                          {onRestore && version.snapshot && index > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-amber-600 hover:text-amber-700"
                              onClick={() => handleRestoreClick(version)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Restore confirmation dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore to Previous Version</DialogTitle>
            <DialogDescription>
              This will restore the {entityType.toLowerCase()} to its state from{' '}
              {selectedVersion && format(selectedVersion.timestamp, 'MMMM d, yyyy \'at\' h:mm a')}.
              Current data will be replaced.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRestore}
              disabled={isRestoring}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isRestoring ? 'Restoring...' : 'Restore Version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      {previewVersion?.snapshot && (
        <Dialog open={!!previewVersion} onOpenChange={() => setPreviewVersion(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>
                Version from {format(previewVersion.timestamp, 'MMMM d, yyyy \'at\' h:mm a')}
              </DialogTitle>
            </DialogHeader>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
              {JSON.stringify(previewVersion.snapshot, null, 2)}
            </pre>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// Hook to manage version history
export function useVersionHistory(entityType: string, entityId: string) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addVersion = (entry: Omit<VersionEntry, 'id' | 'timestamp'>) => {
    const newVersion: VersionEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...entry,
    };
    setVersions(prev => [newVersion, ...prev]);
    
    // Persist to localStorage for demo
    const key = `version_history_${entityType}_${entityId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([newVersion, ...existing].slice(0, 50)));
    
    return newVersion;
  };

  const loadVersions = () => {
    setIsLoading(true);
    try {
      const key = `version_history_${entityType}_${entityId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      setVersions(stored.map((v: VersionEntry) => ({
        ...v,
        timestamp: new Date(v.timestamp),
      })));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    versions,
    isLoading,
    addVersion,
    loadVersions,
  };
}
