import { useSwipeable } from 'react-swipeable';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { haptics } from '@/utils/haptics';

interface SwipeableCartItemProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export function SwipeableCartItem({ children, onDelete }: SwipeableCartItemProps) {
  const [offset, setOffset] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (eventData.dir === 'Left') {
        setOffset(Math.max(-100, Math.min(0, eventData.deltaX)));
        if (eventData.deltaX < -20) {
          haptics.selection();
        }
      }
    },
    onSwiped: () => {
      if (offset < -60) {
        handleDelete();
      } else {
        setOffset(0);
      }
    },
    trackMouse: false, // Only touch, not mouse
    trackTouch: true,
  });

  const handleDelete = () => {
    setIsDeleting(true);
    haptics.medium();
    setTimeout(() => {
      onDelete();
    }, 200);
  };

  return (
    <div className="relative overflow-hidden">
      <div
        {...handlers}
        className={`transition-transform duration-200 ${isDeleting ? 'opacity-0' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-24 bg-destructive flex items-center justify-center"
        style={{ opacity: Math.abs(offset) / 100 }}
      >
        <Trash2 className="w-5 h-5 text-destructive-foreground" />
      </div>
    </div>
  );
}
