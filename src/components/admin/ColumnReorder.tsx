/**
 * Column Reorder Component
 * Drag-to-reorder column configuration using @dnd-kit
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  required?: boolean; // Cannot be hidden
}

interface ColumnReorderProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  storageKey?: string;
  className?: string;
}

interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggleVisibility: (id: string) => void;
}

function SortableColumnItem({ column, onToggleVisibility }: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-md bg-background border',
        isDragging && 'opacity-50 shadow-lg z-50'
      )}
    >
      <button
        className="cursor-grab touch-none p-1 hover:bg-muted rounded"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <span className="flex-1 text-sm">{column.label}</span>
      
      {!column.required && (
        <button
          onClick={() => onToggleVisibility(column.id)}
          className="p-1 hover:bg-muted rounded"
        >
          {column.visible ? (
            <Eye className="h-4 w-4 text-muted-foreground" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  );
}

export function ColumnReorder({
  columns,
  onColumnsChange,
  storageKey,
  className,
}: ColumnReorderProps) {
  const [open, setOpen] = useState(false);
  const [localColumns, setLocalColumns] = useState(columns);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load from localStorage if storageKey provided
  useEffect(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const savedConfig = JSON.parse(saved) as ColumnConfig[];
          // Merge with current columns to handle new/removed columns
          const mergedColumns = columns.map((col) => {
            const savedCol = savedConfig.find((s) => s.id === col.id);
            return savedCol
              ? { ...col, visible: savedCol.visible }
              : col;
          });
          
          // Sort by saved order
          mergedColumns.sort((a, b) => {
            const aIndex = savedConfig.findIndex((s) => s.id === a.id);
            const bIndex = savedConfig.findIndex((s) => s.id === b.id);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
          
          setLocalColumns(mergedColumns);
          onColumnsChange(mergedColumns);
        }
      } catch (e) {
        logger.error('Failed to load column config', e);
      }
    }
  }, [storageKey]);

  // Sync external changes
  useEffect(() => {
    if (!storageKey) {
      setLocalColumns(columns);
    }
  }, [columns, storageKey]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalColumns((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Save to localStorage
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(newItems));
        }
        
        onColumnsChange(newItems);
        return newItems;
      });
    }
  }, [storageKey, onColumnsChange]);

  const toggleVisibility = useCallback((columnId: string) => {
    setLocalColumns((items) => {
      const newItems = items.map((item) =>
        item.id === columnId ? { ...item, visible: !item.visible } : item
      );
      
      // Save to localStorage
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(newItems));
      }
      
      onColumnsChange(newItems);
      return newItems;
    });
  }, [storageKey, onColumnsChange]);

  const resetToDefault = useCallback(() => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    setLocalColumns(columns);
    onColumnsChange(columns);
  }, [columns, storageKey, onColumnsChange]);

  const visibleCount = localColumns.filter((c) => c.visible).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Settings2 className="h-4 w-4 mr-2" />
          Columns ({visibleCount}/{localColumns.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Configure Columns</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={resetToDefault}
            >
              Reset
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Drag to reorder • Click eye to show/hide
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localColumns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="space-y-1">
                {localColumns.map((column) => (
                  <SortableColumnItem
                    key={column.id}
                    column={column}
                    onToggleVisibility={toggleVisibility}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Hook to use column configuration with persistence
 */
export function useColumnConfig(
  defaultColumns: ColumnConfig[],
  storageKey: string
): [ColumnConfig[], (columns: ColumnConfig[]) => void] {
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedConfig = JSON.parse(saved) as ColumnConfig[];
        return defaultColumns.map((col) => {
          const savedCol = savedConfig.find((s) => s.id === col.id);
          return savedCol ? { ...col, visible: savedCol.visible } : col;
        }).sort((a, b) => {
          const aIndex = savedConfig.findIndex((s) => s.id === a.id);
          const bIndex = savedConfig.findIndex((s) => s.id === b.id);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });
      }
    } catch (e) {
      logger.error('Failed to load column config', e);
    }
    return defaultColumns;
  });

  const updateColumns = useCallback((newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem(storageKey, JSON.stringify(newColumns));
  }, [storageKey]);

  return [columns, updateColumns];
}
