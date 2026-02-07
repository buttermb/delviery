/**
 * SortableSectionItem
 * Draggable section item for the builder's section list
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Copy, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type SectionConfig } from './storefront-builder.config';

interface SortableSectionItemProps {
    section: SectionConfig;
    isSelected: boolean;
    onSelect: () => void;
    onRemove: (e: React.MouseEvent) => void;
    onDuplicate: (e: React.MouseEvent) => void;
    onToggleVisibility: (e: React.MouseEvent) => void;
    sectionLabel: string;
}

export function SortableSectionItem({
    section,
    isSelected,
    onSelect,
    onRemove,
    onDuplicate,
    onToggleVisibility,
    sectionLabel
}: SortableSectionItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: section.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const isHidden = section.visible === false;

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                } ${isHidden ? 'opacity-50' : ''}`}
        >
            <div className="flex items-center gap-3">
                <button
                    {...attributes}
                    {...listeners}
                    className="touch-none cursor-grab active:cursor-grabbing"
                >
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-sm font-medium">{sectionLabel}</span>
                {isHidden && <EyeOff className="w-3 h-3 text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={onToggleVisibility}
                >
                    {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={onDuplicate}
                >
                    <Copy className="w-3 h-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={onRemove}
                >
                    <Trash2 className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
}
