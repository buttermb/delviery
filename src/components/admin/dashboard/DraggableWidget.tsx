/**
 * DraggableWidget Component
 * 
 * Wraps a dashboard widget to make it draggable when in edit mode.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import { cn } from '@/lib/utils';
import type { WidgetId } from '@/hooks/useDashboardLayout';

interface DraggableWidgetProps {
    id: WidgetId;
    isEditing: boolean;
    children: React.ReactNode;
    className?: string;
}

export function DraggableWidget({
    id,
    isEditing,
    children,
    className,
}: DraggableWidgetProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, disabled: !isEditing });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    if (!isEditing) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'relative group',
                isDragging && 'z-50 opacity-80',
                isEditing && 'ring-2 ring-dashed ring-primary/30 rounded-lg',
                className
            )}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className={cn(
                    'absolute -top-2 left-1/2 -translate-x-1/2 z-10',
                    'flex items-center gap-1 px-3 py-1',
                    'bg-primary text-primary-foreground rounded-full shadow-md',
                    'cursor-grab active:cursor-grabbing',
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    isDragging && 'opacity-100'
                )}
            >
                <GripVertical className="h-4 w-4" />
                <span className="text-xs font-medium">Drag</span>
            </div>

            {children}
        </div>
    );
}
