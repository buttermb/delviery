import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TypewriterHeadlineProps {
  benefits: string[];
  className?: string;
}

export function TypewriterHeadline({ benefits, className = '' }: TypewriterHeadlineProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState(benefits[0] || 'Automate your workflow');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentBenefit = benefits[currentIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting) {
      // Typing
      if (displayText.length < currentBenefit.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentBenefit.slice(0, displayText.length + 1));
        }, 100);
      } else {
        // Finished typing, wait then start deleting
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      }
    } else {
      // Deleting
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(currentBenefit.slice(0, displayText.length - 1));
        }, 50);
      } else {
        // Finished deleting, move to next benefit
        setIsDeleting(false);
        setCurrentIndex((prev) => (prev + 1) % benefits.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentIndex, benefits]);

  return (
    <div className={`${className}`}>
      <span className="text-white/90">
        {displayText}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-0.5 h-6 bg-white ml-1"
        />
      </span>
    </div>
  );
}

