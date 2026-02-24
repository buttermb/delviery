/**
 * Workflow Version History Component
 * Shows version timeline with rollback capability
 */

import { useState } from 'react';
import { useWorkflowVersions } from '@/hooks/useWorkflowVersions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  RotateCcw,
  GitBranch,
  Clock,
  ChevronRight,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface WorkflowAction {
  id?: string;
  name?: string;
  type?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

interface WorkflowCondition {
  id?: string;
  type?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

interface WorkflowVersion {
  id: string;
  workflow_id: string;
  tenant_id: string;
  version_number: number;
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config?: Record<string, unknown>;
  actions: WorkflowAction[];
  conditions?: WorkflowCondition[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
  change_summary?: string;
  change_details?: Record<string, unknown>;
  restored_from_version?: number;
}

interface WorkflowVersionHistoryProps {
  workflowId: string;
  workflowName: string;
}

export function WorkflowVersionHistory({
  workflowId,
  workflowName,
}: WorkflowVersionHistoryProps) {
  const { versions, isLoading, restoreVersion } = useWorkflowVersions(workflowId);
  const [selectedVersion, setSelectedVersion] = useState<WorkflowVersion | null>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  const handleRestore = async () => {
    if (!selectedVersion) return;

    await restoreVersion.mutateAsync({
      workflowId,
      versionNumber: selectedVersion.version_number,
    });

    setRestoreDialogOpen(false);
    setSelectedVersion(null);
  };

  const handleViewDetails = (version: WorkflowVersion) => {
    setSelectedVersion(version);
    setDetailsDialogOpen(true);
  };

  const handleRestoreClick = (version: WorkflowVersion) => {
    setSelectedVersion(version);
    setRestoreDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading version history...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Version History
              </CardTitle>
              <CardDescription>
                Track and restore previous versions of {workflowName}
              </CardDescription>
            </div>
            <Badge variant="outline">
              {versions.length} {versions.length === 1 ? 'version' : 'versions'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {versions && versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No version history available
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="relative space-y-4">
                {/* Timeline line */}
                <div className="absolute left-[21px] top-2 bottom-2 w-0.5 bg-border" />

                {versions && versions.map((version: WorkflowVersion, index: number) => (
                  <div key={version.id} className="relative flex gap-4">
                    {/* Timeline node */}
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background">
                      {index === 0 ? (
                        <Check className="h-5 w-5 text-primary" />
                      ) : version.restored_from_version ? (
                        <RotateCcw className="h-4 w-4 text-warning" />
                      ) : (
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Version card */}
                    <Card className="flex-1">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-base">
                                Version {version.version_number}
                              </CardTitle>
                              {index === 0 && (
                                <Badge variant="default">Current</Badge>
                              )}
                              {version.restored_from_version && (
                                <Badge variant="secondary">
                                  Restored from v{version.restored_from_version}
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(version.created_at), {
                                addSuffix: true,
                              })}
                            </CardDescription>
                          </div>
                          {index !== 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreClick(version)}
                              disabled={restoreVersion.isPending}
                            >
                              {restoreVersion.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                              Restore
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3">
                        {version.change_summary && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-muted-foreground mb-1">
                              Changes:
                            </p>
                            <p className="text-sm">{version.change_summary}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Name:</span>
                            <p className="font-medium">{version.name}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Trigger Type:
                            </span>
                            <p className="font-medium">{version.trigger_type}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Actions:</span>
                            <p className="font-medium">
                              {version.actions?.length ?? 0}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <Badge
                              variant={version.is_active ? 'default' : 'secondary'}
                            >
                              {version.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => handleViewDetails(version)}
                        >
                          View Details
                          <ChevronRight className="h-4 w-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Restore Version {selectedVersion?.version_number}?
            </DialogTitle>
            <DialogDescription>
              This will restore the workflow to version{' '}
              {selectedVersion?.version_number}. The current version will be saved
              in history, and you can restore it later if needed.
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Restoring to:</span>
                  <p className="font-medium">
                    Version {selectedVersion.version_number}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p className="font-medium">
                    {formatDistanceToNow(new Date(selectedVersion.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>

              {selectedVersion.change_summary && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Changes in this version:</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedVersion.change_summary}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={restoreVersion.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              disabled={restoreVersion.isPending}
            >
              {restoreVersion.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Restoring...</>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Version {selectedVersion?.version_number} Details
            </DialogTitle>
            <DialogDescription>
              {selectedVersion?.created_at &&
                new Date(selectedVersion.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Name
                  </p>
                  <p className="text-sm">{selectedVersion.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Status
                  </p>
                  <Badge
                    variant={selectedVersion.is_active ? 'default' : 'secondary'}
                  >
                    {selectedVersion.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              {selectedVersion.description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm">{selectedVersion.description}</p>
                </div>
              )}

              {selectedVersion.change_summary && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Change Summary
                  </p>
                  <p className="text-sm">{selectedVersion.change_summary}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Trigger Configuration
                </p>
                <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(
                    {
                      type: selectedVersion.trigger_type,
                      config: selectedVersion.trigger_config,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Actions ({selectedVersion.actions?.length ?? 0})
                </p>
                <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(selectedVersion.actions, null, 2)}
                </pre>
              </div>

              {selectedVersion.conditions &&
                selectedVersion.conditions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Conditions
                    </p>
                    <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                      {JSON.stringify(selectedVersion.conditions, null, 2)}
                    </pre>
                  </div>
                )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDetailsDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
