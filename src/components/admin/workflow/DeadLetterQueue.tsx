/**
 * Dead Letter Queue Dashboard
 * View and manage failed workflow executions
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  AlertCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { useDeadLetterQueue } from '@/hooks/useDeadLetterQueue';
import { formatDistanceToNow } from 'date-fns';

import type { DeadLetterEntry } from '@/hooks/useDeadLetterQueue';

export function DeadLetterQueue() {
  const { entries, isLoading, stats, retryExecution, resolveEntry, ignoreEntry, deleteEntry } = useDeadLetterQueue();
  const [selectedEntry, setSelectedEntry] = useState<DeadLetterEntry | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  
  const handleViewDetails = (entry: DeadLetterEntry) => {
    setSelectedEntry(entry);
    setShowDetails(true);
  };
  
  const handleRetry = async (entry: DeadLetterEntry) => {
    await retryExecution.mutateAsync(entry.id);
  };

  const filteredEntries = entries.filter(entry => {
    if (filterStatus !== 'all' && entry.status !== filterStatus) return false;
    if (searchQuery && !entry.workflow.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleResolve = async () => {
    if (!selectedEntry) return;
    await resolveEntry.mutateAsync({ id: selectedEntry.id, notes: resolutionNotes });
    setShowDetails(false);
    setResolutionNotes('');
  };

  const handleIgnore = async () => {
    if (!selectedEntry) return;
    await ignoreEntry.mutateAsync({ id: selectedEntry.id, notes: resolutionNotes });
    setShowDetails(false);
    setResolutionNotes('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'failed': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'retrying': return <RefreshCw className="h-4 w-4 text-warning animate-spin" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'ignored': return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'failed': return 'destructive';
      case 'retrying': return 'warning';
      case 'resolved': return 'success';
      case 'ignored': return 'secondary';
      default: return 'default';
    }
  };

  if (isLoading) {
    return <div>Loading dead letter queue...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{stats.retrying}</div>
            <p className="text-xs text-muted-foreground">Retrying</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">Resolved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-muted-foreground">{stats.ignored}</div>
            <p className="text-xs text-muted-foreground">Ignored</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Dead Letter Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="retrying">Retrying</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entries List */}
          <div className="space-y-2">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No entries found
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <Card key={entry.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(entry.status)}
                        <span className="font-medium">{entry.workflow.name}</span>
                        <Badge variant={getStatusVariant(entry.status) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                          {entry.status}
                        </Badge>
                        <Badge variant="outline">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {entry.error_type}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <p className="truncate">{entry.error_message}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            {entry.total_attempts} attempts
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Failed {formatDistanceToNow(new Date(entry.first_failed_at))} ago
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(entry as DeadLetterEntry)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                      {entry.status === 'failed' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleRetry(entry as DeadLetterEntry)}
                          disabled={retryExecution.isPending}
                        >
                          {retryExecution.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEntryToDelete(entry.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Workflow</h3>
                <p>{selectedEntry.workflow.name}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Error Information</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{selectedEntry.error_type}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {selectedEntry.total_attempts} attempts
                    </span>
                  </div>
                  <p className="text-sm">{selectedEntry.error_message}</p>
                  {selectedEntry.error_stack && (
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {selectedEntry.error_stack}
                    </pre>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Trigger Data</h3>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(selectedEntry.trigger_data, null, 2)}
                </pre>
              </div>

              {selectedEntry.execution_log && selectedEntry.execution_log.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Execution Log</h3>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-60">
                    {JSON.stringify(selectedEntry.execution_log, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Resolution Notes</h3>
                <Textarea
                  placeholder="Add notes about resolution..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Close
            </Button>
            {selectedEntry?.status === 'failed' && (
              <>
                <Button variant="secondary" onClick={handleIgnore}>
                  Ignore
                </Button>
                <Button variant="default" onClick={handleResolve}>
                  Mark Resolved
                </Button>
                <Button onClick={() => handleRetry(selectedEntry)}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Now
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (entryToDelete) {
            deleteEntry.mutate(entryToDelete);
            setDeleteDialogOpen(false);
            setEntryToDelete(null);
          }
        }}
        itemType="entry"
        isLoading={deleteEntry.isPending}
      />
    </div>
  );
}
