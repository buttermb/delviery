import { useEffect, useRef } from 'react';
import { useSpring, useMotionValue, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CreditBalanceAnimationProps {
    value: number;
    className?: string;
    prefix?: string;
}

export function CreditBalanceAnimation({
    value,
    className,
    prefix = ''
}: CreditBalanceAnimationProps) {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(value);
    const springValue = useSpring(motionValue, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });
    const displayValue = useTransform(springValue, (current) => Math.round(current).toLocaleString());

    useEffect(() => {
        motionValue.set(value);
    }, [value, motionValue]);

    useEffect(() => {
        const unsubscribe = displayValue.on('change', (latest) => {
            if (ref.current) {
                ref.current.textContent = `${prefix}${latest}`;
            }
        });
        return unsubscribe;
    }, [displayValue, prefix]);

    return (
        <span
            ref={ref}
            className={cn("tabular-nums", className)}
        >
            {prefix}{value.toLocaleString()}
        </span>
    );
}
