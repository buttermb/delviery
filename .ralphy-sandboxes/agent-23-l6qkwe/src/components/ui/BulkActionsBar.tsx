import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  X,
  Trash2,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  Loader2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExportButton } from "./ExportButton";
import { cn } from "@/lib/utils";

export interface BulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  disabled?: boolean;
  tooltip?: string;
  onClick: (selectedIds: string[]) => Promise<void> | void;
}

interface BulkActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  actions?: BulkAction[];
  data?: Record<string, unknown>[];
  exportFilename?: string;
  exportColumns?: { key: string; label: string }[];
  className?: string;
}

export function BulkActionsBar({
  selectedIds,
  onClearSelection,
  actions = [],
  data,
  exportFilename,
  exportColumns,
  className,
}: BulkActionsBarProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (selectedIds.length === 0) {
    return null;
  }

  const handleAction = async (action: BulkAction) => {
    setLoadingAction(action.id);
    try {
      await action.onClick(selectedIds);
    } finally {
      setLoadingAction(null);
    }
  };

  // Get selected data for export
  const selectedData = data?.filter(item => selectedIds.includes(item.id as string)) ?? [];

  // Split actions into primary (first 2) and overflow
  const primaryActions = actions.slice(0, 2);
  const overflowActions = actions.slice(2);

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "bg-background border rounded-xl shadow-2xl",
        "px-4 py-3 flex items-center gap-3",
        "animate-in slide-in-from-bottom-4 fade-in-0 duration-200",
        className
      )}
    >
      {/* Selection count */}
      <div className="flex items-center gap-2 pr-3 border-r">
        <span className="text-sm font-medium">
          {selectedIds.length} selected
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 sm:h-6 sm:w-6"
          onClick={onClearSelection}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Primary actions */}
      {primaryActions.map((action) => {
        const btn = (
          <Button
            key={action.id}
            variant={action.variant === "destructive" ? "destructive" : "secondary"}
            size="sm"
            onClick={() => handleAction(action)}
            disabled={action.disabled || loadingAction !== null}
          >
            {loadingAction === action.id ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              action.icon && <span className="mr-2">{action.icon}</span>
            )}
            {action.label}
          </Button>
        );
        if (action.disabled && action.tooltip) {
          return (
            <TooltipProvider key={action.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>{btn}</span>
                </TooltipTrigger>
                <TooltipContent>{action.tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return btn;
      })}

      {/* Export selected */}
      {data && selectedData.length > 0 && (
        <ExportButton
          data={selectedData}
          filename={exportFilename ? `${exportFilename}-selected` : "selected-export"}
          columns={exportColumns}
        />
      )}

      {/* Overflow menu */}
      {overflowActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-11 w-11" aria-label="More bulk actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {overflowActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                onClick={() => handleAction(action)}
                disabled={action.disabled}
                className={action.variant === "destructive" ? "text-destructive" : ""}
                title={action.disabled && action.tooltip ? action.tooltip : undefined}
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// Pre-built common bulk actions
export const commonBulkActions = {
  delete: (onDelete: (ids: string[]) => Promise<void>): BulkAction => ({
    id: "delete",
    label: "Delete",
    icon: <Trash2 className="h-4 w-4" />,
    variant: "destructive",
    onClick: onDelete,
  }),
  
  activate: (onActivate: (ids: string[]) => Promise<void>): BulkAction => ({
    id: "activate",
    label: "Activate",
    icon: <CheckCircle className="h-4 w-4" />,
    onClick: onActivate,
  }),
  
  deactivate: (onDeactivate: (ids: string[]) => Promise<void>): BulkAction => ({
    id: "deactivate",
    label: "Deactivate",
    icon: <XCircle className="h-4 w-4" />,
    onClick: onDeactivate,
  }),
};