import { useState, useEffect } from 'react';

export function CountdownTimer() {
    const [timeLeft, setTimeLeft] = useState(59 * 60 + 59); // 59 minutes 59 seconds

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    const isUrgent = timeLeft < 60; // Less than 1 minute
    const isCritical = timeLeft < 10; // Less than 10 seconds

    return (
        <div className="flex justify-center">
            <div className={`
        text-[10px] font-mono font-bold transition-colors duration-500
        ${isCritical ? 'text-red-500 animate-pulse' : isUrgent ? 'text-amber-500' : 'text-[hsl(var(--marketing-primary))]'}
      `}>
                Link expires in {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
        </div>
    );
}
