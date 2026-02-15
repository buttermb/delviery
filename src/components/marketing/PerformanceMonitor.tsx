import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * FPS Monitor - Shows real-time FPS in dev mode
 * Tracks animation performance
 */
export function PerformanceMonitor() {
  const [fps, setFps] = useState(60);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime >= lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }
      
      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);

    // Toggle visibility with Ctrl+Shift+P
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  if (!import.meta.env.DEV) return null;

  const fpsColor = fps >= 55 ? 'bg-green-500' : fps >= 30 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 right-4 z-max bg-black/90 text-white px-4 py-2 rounded-lg font-mono text-sm backdrop-blur-sm"
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${fpsColor}`} />
            <span>{fps} FPS</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Press Ctrl+Shift+P to toggle
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
