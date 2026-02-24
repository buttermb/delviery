/**
 * Bulk Actions Component
 * Toolbar for bulk operations on selected items
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Download, Edit, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

interface BulkActionsProps {
  selectedCount: number;
  actions?: BulkAction[];
  onDelete?: () => void;
  onExport?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function BulkActions({
  selectedCount,
  actions,
  onDelete,
  onExport,
  onEdit,
  className,
}: BulkActionsProps) {
  if (selectedCount === 0) return null;

  const defaultActions: BulkAction[] = [];

  if (onEdit) {
    defaultActions.push({
      label: 'Edit Selected',
      icon: <Edit className="h-4 w-4" />,
      onClick: onEdit,
    });
  }

  if (onExport) {
    defaultActions.push({
      label: 'Export Selected',
      icon: <Download className="h-4 w-4" />,
      onClick: onExport,
    });
  }

  if (onDelete) {
    defaultActions.push({
      label: 'Delete Selected',
      icon: <Trash2 className="h-4 w-4" />,
      onClick: onDelete,
      variant: 'destructive',
    });
  }

  const allActions = actions || defaultActions;

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Badge variant="secondary" className="mr-2">
        {selectedCount} selected
      </Badge>

      {allActions.length <= 3 ? (
        // Show buttons directly if 3 or fewer actions
        allActions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
            size="sm"
            onClick={action.onClick}
          >
            {action.icon}
            <span className="ml-2">{action.label}</span>
          </Button>
        ))
      ) : (
        // Use dropdown for more than 3 actions
        <>
          {allActions.slice(0, 2).map((action, index) => (
            <Button
              key={index}
              variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
              size="sm"
              onClick={action.onClick}
            >
              {action.icon}
              <span className="ml-2">{action.label}</span>
            </Button>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {allActions.slice(2).map((action, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={action.onClick}
                  className={action.variant === 'destructive' ? 'text-destructive' : ''}
                >
                  {action.icon}
                  <span className="ml-2">{action.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

