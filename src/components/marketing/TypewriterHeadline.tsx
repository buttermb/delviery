import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TypewriterHeadlineProps {
  text: string;
  className?: string;
}

export function TypewriterHeadline({ text, className = "" }: TypewriterHeadlineProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [isComplete, setIsComplete] = useState(false);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedText(text);
      setShowCursor(false);
      setIsComplete(true);
      return;
    }

    let currentIndex = 0;
    const typingSpeed = 50; // milliseconds per character

    const typingInterval = setInterval(() => {
      if (currentIndex <= text.length) {
        setDisplayedText(text.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsComplete(true);
        // Fade out cursor after completion
        setTimeout(() => setShowCursor(false), 500);
      }
    }, typingSpeed);

    // Cursor blink
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);

    return () => {
      clearInterval(typingInterval);
      clearInterval(cursorInterval);
    };
  }, [text, prefersReducedMotion]);

  return (
    <h1 className={className}>
      {displayedText}
      <AnimatePresence>
        {!isComplete && showCursor && (
          <motion.span
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="inline-block w-0.5 h-[0.9em] bg-white/90 ml-1 align-middle"
          />
        )}
      </AnimatePresence>
    </h1>
  );
}
