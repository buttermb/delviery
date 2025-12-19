/**
 * Draggable Kanban Board Component
 * 
 * Provides drag-and-drop functionality for kanban-style boards
 * Uses @dnd-kit for accessibility and touch support
 */

import { useState, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    DragOverEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

// Generic item type
export interface DraggableItem {
    id: string;
    columnId: string;
    [key: string]: unknown;
}

// Column type
export interface DraggableColumn<T extends DraggableItem> {
    id: string;
    title: string;
    items: T[];
    className?: string;
    headerClassName?: string;
}

// Props for the kanban board
interface DraggableKanbanProps<T extends DraggableItem> {
    columns: DraggableColumn<T>[];
    onItemMove: (itemId: string, fromColumn: string, toColumn: string, newIndex: number) => void;
    onReorder?: (columnId: string, items: T[]) => void;
    renderItem: (item: T, isDragging: boolean) => React.ReactNode;
    renderColumnHeader?: (column: DraggableColumn<T>) => React.ReactNode;
    renderEmptyColumn?: (column: DraggableColumn<T>) => React.ReactNode;
    disabled?: boolean;
    className?: string;
}

/**
 * Sortable Item Wrapper
 */
function SortableItem<T extends DraggableItem>({
    item,
    renderItem,
    disabled,
}: {
    item: T;
    renderItem: (item: T, isDragging: boolean) => React.ReactNode;
    disabled?: boolean;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id, disabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: disabled ? 'default' : 'grab',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'relative group',
                isDragging && 'z-50'
            )}
        >
            {/* Drag Handle */}
            {!disabled && (
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-grab active:cursor-grabbing"
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
            )}
            {renderItem(item, isDragging)}
        </div>
    );
}

/**
 * Droppable Column
 */
function DroppableColumn<T extends DraggableItem>({
    column,
    renderItem,
    renderHeader,
    renderEmpty,
    disabled,
}: {
    column: DraggableColumn<T>;
    renderItem: (item: T, isDragging: boolean) => React.ReactNode;
    renderHeader?: (column: DraggableColumn<T>) => React.ReactNode;
    renderEmpty?: (column: DraggableColumn<T>) => React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <div className={cn('flex flex-col min-h-[200px]', column.className)}>
            {/* Column Header */}
            {renderHeader ? (
                renderHeader(column)
            ) : (
                <div className={cn('font-semibold text-sm mb-3', column.headerClassName)}>
                    {column.title} ({column.items.length})
                </div>
            )}

            {/* Sortable Items */}
            <SortableContext
                items={column.items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="space-y-2 flex-1">
                    {column.items.length === 0 ? (
                        renderEmpty ? (
                            renderEmpty(column)
                        ) : (
                            <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                Drop items here
                            </div>
                        )
                    ) : (
                        column.items.map((item) => (
                            <SortableItem
                                key={item.id}
                                item={item}
                                renderItem={renderItem}
                                disabled={disabled}
                            />
                        ))
                    )}
                </div>
            </SortableContext>
        </div>
    );
}

/**
 * Draggable Kanban Board
 * 
 * @example
 * ```tsx
 * <DraggableKanban
 *   columns={columns}
 *   onItemMove={(itemId, from, to, index) => {
 *     // Handle item move between columns
 *   }}
 *   renderItem={(item, isDragging) => (
 *     <Card className={isDragging ? 'shadow-lg' : ''}>
 *       {item.title}
 *     </Card>
 *   )}
 * />
 * ```
 */
export function DraggableKanban<T extends DraggableItem>({
    columns,
    onItemMove,
    onReorder,
    renderItem,
    renderColumnHeader,
    renderEmptyColumn,
    disabled = false,
    className,
}: DraggableKanbanProps<T>) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [activeItem, setActiveItem] = useState<T | null>(null);

    // Configure sensors for pointer and touch
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Find item by ID across all columns
    const findItem = useCallback((id: string): T | null => {
        for (const column of columns) {
            const item = column.items.find((i) => i.id === id);
            if (item) return item;
        }
        return null;
    }, [columns]);

    // Find column containing item
    const findColumn = useCallback((id: string): string | null => {
        for (const column of columns) {
            if (column.items.some((i) => i.id === id)) {
                return column.id;
            }
        }
        // Check if it's a column ID
        if (columns.some((c) => c.id === id)) {
            return id;
        }
        return null;
    }, [columns]);

    // Handle drag start
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        setActiveId(active.id as string);
        setActiveItem(findItem(active.id as string));
    }, [findItem]);

    // Handle drag end
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        setActiveId(null);
        setActiveItem(null);

        if (!over) return;

        const activeItemId = active.id as string;
        const overId = over.id as string;

        const activeColumn = findColumn(activeItemId);
        let overColumn = findColumn(overId);

        // If over is a column ID, use it directly
        if (columns.some((c) => c.id === overId)) {
            overColumn = overId;
        }

        if (!activeColumn || !overColumn) return;

        if (activeColumn !== overColumn) {
            // Moving to different column
            const overColumnObj = columns.find((c) => c.id === overColumn);
            const newIndex = overColumnObj?.items.length || 0;

            onItemMove(activeItemId, activeColumn, overColumn, newIndex);
        } else if (onReorder) {
            // Reordering within same column
            const column = columns.find((c) => c.id === activeColumn);
            if (!column) return;

            const oldIndex = column.items.findIndex((i) => i.id === activeItemId);
            const newIndex = column.items.findIndex((i) => i.id === overId);

            if (oldIndex !== newIndex) {
                const newItems = [...column.items];
                const [removed] = newItems.splice(oldIndex, 1);
                newItems.splice(newIndex, 0, removed);
                onReorder(activeColumn, newItems);
            }
        }
    }, [columns, findColumn, onItemMove, onReorder]);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', className)}>
                {columns.map((column) => (
                    <DroppableColumn
                        key={column.id}
                        column={column}
                        renderItem={renderItem}
                        renderHeader={renderColumnHeader}
                        renderEmpty={renderEmptyColumn}
                        disabled={disabled}
                    />
                ))}
            </div>

            {/* Drag Overlay - shows dragged item */}
            <DragOverlay>
                {activeItem ? (
                    <div className="transform scale-105 shadow-xl">
                        {renderItem(activeItem, true)}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

export default DraggableKanban;
