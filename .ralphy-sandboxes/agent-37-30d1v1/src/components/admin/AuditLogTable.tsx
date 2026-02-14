/**
 * AuditLogTable
 * Displays audit trail entries in a structured table format with change details.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Shield, History } from 'lucide-react';
import type { AuditTrailEntry } from '@/types/auditTrail';

interface AuditLogTableProps {
  entries: AuditTrailEntry[];
  isLoading?: boolean;
}

function getActionBadgeVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (action) {
    case 'create':
      return 'default';
    case 'update':
      return 'secondary';
    case 'delete':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getActionIcon(action: string) {
  switch (action) {
    case 'create':
      return <Plus className="h-3 w-3" />;
    case 'update':
      return <Pencil className="h-3 w-3" />;
    case 'delete':
      return <Trash2 className="h-3 w-3" />;
    default:
      return <Shield className="h-3 w-3" />;
  }
}

function formatResourceType(type: string | null): string {
  if (!type) return 'Unknown';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatActorType(type: string | null): string {
  if (!type) return 'System';
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ChangesDetail({ changes }: { changes: Record<string, unknown> | null }) {
  if (!changes) return <span className="text-muted-foreground text-xs">No details</span>;

  const changedFields = changes.changed_fields as Record<string, unknown> | undefined;

  if (changedFields && Object.keys(changedFields).length > 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground mb-1">Changed fields:</p>
        <div className="grid gap-1">
          {Object.entries(changedFields).map(([key, value]) => (
            <div key={key} className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
              <span className="text-muted-foreground">{key}:</span>{' '}
              <span>{String(value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <pre className="text-xs font-mono bg-muted/50 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap">
      {JSON.stringify(changes, null, 2)}
    </pre>
  );
}

function AuditLogRow({ entry }: { entry: AuditTrailEntry }) {
  const [open, setOpen] = useState(false);
  const hasChanges = entry.changes && Object.keys(entry.changes).length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <>
        <TableRow className="group">
          <TableCell className="w-[40px]">
            {hasChanges ? (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {open ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </Button>
              </CollapsibleTrigger>
            ) : (
              <span className="block h-6 w-6" />
            )}
          </TableCell>
          <TableCell>
            <Badge variant={getActionBadgeVariant(entry.action)} className="gap-1">
              {getActionIcon(entry.action)}
              {entry.action}
            </Badge>
          </TableCell>
          <TableCell>{formatResourceType(entry.resource_type)}</TableCell>
          <TableCell className="font-mono text-xs text-muted-foreground">
            {entry.resource_id ? entry.resource_id.slice(0, 8) + '...' : '-'}
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="text-xs">
              {formatActorType(entry.actor_type)}
            </Badge>
          </TableCell>
          <TableCell className="text-muted-foreground text-sm">
            {new Date(entry.created_at).toLocaleString()}
          </TableCell>
        </TableRow>
        {hasChanges && (
          <CollapsibleContent asChild>
            <TableRow>
              <TableCell />
              <TableCell colSpan={5} className="bg-muted/30">
                <ChangesDetail changes={entry.changes} />
              </TableCell>
            </TableRow>
          </CollapsibleContent>
        )}
      </>
    </Collapsible>
  );
}

export function AuditLogTable({ entries, isLoading }: AuditLogTableProps) {
  if (!isLoading && entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">No audit log entries found</p>
        <p className="text-sm mt-1">
          Audit entries will appear here as changes are made to products, orders, and team members.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]" />
          <TableHead className="w-[120px]">Action</TableHead>
          <TableHead>Resource</TableHead>
          <TableHead className="w-[120px]">Resource ID</TableHead>
          <TableHead className="w-[140px]">Actor</TableHead>
          <TableHead className="w-[200px]">Timestamp</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <AuditLogRow key={entry.id} entry={entry} />
        ))}
      </TableBody>
    </Table>
  );
}
