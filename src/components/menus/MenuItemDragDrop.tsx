import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  display_order?: number;
}

interface MenuItemDragDropProps {
  items: MenuItem[];
  onReorder: (reorderedItems: MenuItem[]) => void;
}

export function MenuItemDragDrop({ items, onReorder }: MenuItemDragDropProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggingIndex(index);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggingIndex === null || draggingIndex === targetIndex) return;

    const reorderedItems = Array.from(items);
    const [removed] = reorderedItems.splice(draggingIndex, 1);
    reorderedItems.splice(targetIndex, 0, removed);

    onReorder(reorderedItems);
    toast.success('Menu items reordered');
    setDraggingIndex(null);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <Card
          key={item.id}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(index)}
          className={`p-3 flex items-center gap-3 cursor-move ${
            draggingIndex === index ? 'opacity-50' : ''
          }`}
        >
          <div className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="font-medium">{item.name}</div>
            {item.category && (
              <Badge variant="secondary" className="text-xs">
                {item.category}
              </Badge>
            )}
          </div>
          <div className="font-mono font-bold">${item.price.toFixed(2)}</div>
        </Card>
      ))}
    </div>
  );
}
