import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { useMenuCartStore } from '@/stores/menuCartStore';
import { Badge } from '@/components/ui/badge';

interface CartButtonProps {
  onClick: () => void;
}

export function CartButton({ onClick }: CartButtonProps) {
  const totalItems = useMenuCartStore((state) => state.getItemCount());
  const totalAmount = useMenuCartStore((state) => state.getTotal());

  if (totalItems === 0) return null;

  return (
    <Button
      size="lg"
      className="fixed bottom-6 right-6 h-14 px-6 shadow-lg z-50"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <ShoppingCart className="h-5 w-5" />
          <Badge
            variant="secondary"
            className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {totalItems}
          </Badge>
        </div>
        <div className="flex flex-col items-start">
          <span className="text-xs opacity-90">View Cart</span>
          <span className="text-sm font-bold">${totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </Button>
  );
}
