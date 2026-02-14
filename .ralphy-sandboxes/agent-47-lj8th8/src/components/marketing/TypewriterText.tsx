import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface TypewriterTextProps {
    text: string;
    className?: string;
    delay?: number;
}

export function TypewriterText({ text, className = "", delay = 0 }: TypewriterTextProps) {
    const [displayedText, setDisplayedText] = useState("");

    useEffect(() => {
        const startTimeout = setTimeout(() => {
            let currentIndex = 0;
            const intervalId = setInterval(() => {
                if (currentIndex <= text.length) {
                    setDisplayedText(text.slice(0, currentIndex));
                    currentIndex++;
                } else {
                    clearInterval(intervalId);
                }
            }, 30); // Typing speed

            return () => clearInterval(intervalId);
        }, delay * 1000);

        return () => clearTimeout(startTimeout);
    }, [text, delay]);

    return (
        <span className={className}>
            {displayedText}
            <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-[2px] h-[1em] bg-[hsl(var(--marketing-primary))] ml-1 align-middle"
            />
        </span>
    );
}
