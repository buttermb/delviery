/**
 * StarRating Component
 * Interactive star rating input and static display
 */

import Star from "lucide-react/dist/esm/icons/star";
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface StarRatingProps {
    /** Current rating value (1-5) */
    value: number;
    /** Callback when rating changes (interactive mode) */
    onChange?: (rating: number) => void;
    /** Maximum rating (default: 5) */
    max?: number;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Read-only mode (no interaction) */
    readonly?: boolean;
    /** Show rating number text */
    showValue?: boolean;
    /** Custom className */
    className?: string;
}

const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
};

export function StarRating({
    value,
    onChange,
    max = 5,
    size = 'md',
    readonly = false,
    showValue = false,
    className,
}: StarRatingProps) {
    const [hoverRating, setHoverRating] = useState<number | null>(null);

    const displayRating = hoverRating ?? value;
    const isInteractive = !readonly && !!onChange;

    const handleClick = (rating: number) => {
        if (isInteractive) {
            onChange(rating);
        }
    };

    const handleMouseEnter = (rating: number) => {
        if (isInteractive) {
            setHoverRating(rating);
        }
    };

    const handleMouseLeave = () => {
        if (isInteractive) {
            setHoverRating(null);
        }
    };

    return (
        <div className={cn('flex items-center gap-0.5', className)}>
            <div className="flex gap-0.5">
                {Array.from({ length: max }, (_, i) => {
                    const starValue = i + 1;
                    const isFilled = starValue <= displayRating;

                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={readonly}
                            onClick={() => handleClick(starValue)}
                            onMouseEnter={() => handleMouseEnter(starValue)}
                            onMouseLeave={handleMouseLeave}
                            className={cn(
                                'transition-all',
                                isInteractive && 'cursor-pointer hover:scale-110',
                                readonly && 'cursor-default'
                            )}
                            aria-label={`Rate ${starValue} out of ${max} stars`}
                        >
                            <Star
                                className={cn(
                                    sizeClasses[size],
                                    'transition-colors',
                                    isFilled
                                        ? 'fill-yellow-400 text-yellow-400'
                                        : 'fill-none text-muted-foreground'
                                )}
                            />
                        </button>
                    );
                })}
            </div>

            {showValue && (
                <span className="ml-2 text-sm font-medium text-muted-foreground">
                    {value.toFixed(1)}
                </span>
            )}
        </div>
    );
}
