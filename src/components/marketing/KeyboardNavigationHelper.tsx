import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Keyboard from "lucide-react/dist/esm/icons/keyboard";

export function KeyboardNavigationHelper() {
  const [showHelper, setShowHelper] = useState(false);

  useEffect(() => {
    let keyPressCount = 0;
    let timeoutId: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Show helper when user presses Tab multiple times
      if (e.key === 'Tab') {
        keyPressCount++;
        
        if (keyPressCount >= 3 && !showHelper) {
          setShowHelper(true);
          setTimeout(() => setShowHelper(false), 5000);
        }

        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          keyPressCount = 0;
        }, 2000);
      }

      // Show helper on ? key
      if (e.key === '?' && !showHelper) {
        setShowHelper(true);
        setTimeout(() => setShowHelper(false), 5000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeoutId);
    };
  }, [showHelper]);

  return (
    <AnimatePresence>
      {showHelper && (
        <motion.div
          className="fixed bottom-8 right-8 z-50 pointer-events-none"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="glass-card p-4 rounded-xl border border-primary/20 shadow-2xl max-w-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Keyboard className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm mb-2 text-foreground">
                  Keyboard Navigation Tips
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Tab</kbd> - Navigate forward</li>
                  <li>• <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Shift+Tab</kbd> - Navigate back</li>
                  <li>• <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> - Activate element</li>
                  <li>• <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Esc</kbd> - Close dialogs</li>
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
