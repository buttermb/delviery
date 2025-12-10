/**
 * Floating Cart Button - Animated cart FAB with badge
 * Ported from BudDash
 */

import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FloatingCartButtonProps {
    itemCount: number;
    onClick: () => void;
    className?: string;
    accentColor?: string;
}

export function FloatingCartButton({
    itemCount,
    onClick,
    className,
    accentColor = '#10b981'
}: FloatingCartButtonProps) {
    if (itemCount === 0) return null;

    return (
        <Button
            onClick={onClick}
            size="lg"
            className={cn(
                "fixed bottom-24 md:bottom-6 right-4 md:right-6 z-50",
                "h-14 w-14 md:h-16 md:w-16 rounded-full p-0",
                "shadow-[0_8px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)]",
                "animate-in fade-in slide-in-from-bottom-4 duration-300",
                "hover:scale-110 active:scale-95 transition-all duration-200",
                "text-white border-0",
                className
            )}
            style={{ backgroundColor: accentColor }}
            aria-label={`Shopping cart with ${itemCount} items`}
        >
            <ShoppingCart className="h-6 w-6 md:h-7 md:w-7" />
            <Badge
                className={cn(
                    "absolute -top-1 -right-1 rounded-full",
                    "h-6 w-6 md:h-7 md:w-7",
                    "flex items-center justify-center",
                    "text-xs font-bold leading-none",
                    "shadow-lg border-2 border-black",
                    "bg-white text-black",
                    "animate-in zoom-in-50 duration-200"
                )}
            >
                {itemCount > 9 ? '9+' : itemCount}
            </Badge>
        </Button>
    );
}
