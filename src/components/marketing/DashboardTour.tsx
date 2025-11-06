import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourStep {
  id: number;
  title: string;
  description: string;
  highlight: { x: string; y: string; width: string; height: string };
  position: 'top' | 'bottom' | 'left' | 'right';
}

const tourSteps: TourStep[] = [
  {
    id: 1,
    title: 'Dashboard Overview',
    description: 'Get real-time insights into your business performance with our comprehensive dashboard.',
    highlight: { x: '10%', y: '15%', width: '80%', height: '25%' },
    position: 'bottom',
  },
  {
    id: 2,
    title: 'Quick Actions',
    description: 'Access frequently used features with one click - create orders, add products, or generate menus.',
    highlight: { x: '15%', y: '45%', width: '30%', height: '20%' },
    position: 'right',
  },
  {
    id: 3,
    title: 'Analytics & Insights',
    description: 'Track key metrics and identify trends with beautiful, interactive charts.',
    highlight: { x: '55%', y: '45%', width: '30%', height: '20%' },
    position: 'left',
  },
  {
    id: 4,
    title: 'Recent Activity',
    description: 'Stay updated with real-time notifications about orders, inventory, and customer actions.',
    highlight: { x: '10%', y: '70%', width: '80%', height: '20%' },
    position: 'top',
  },
];

export function DashboardTour() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Auto-start after 2 seconds
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying || !isVisible) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= tourSteps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isPlaying, isVisible, currentStep]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsVisible(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const step = tourSteps[currentStep];

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Overlay with spotlight */}
      <motion.div
        className="absolute inset-0 bg-black/60 pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      />

      {/* Highlight area */}
      <motion.div
        className="absolute border-4 border-[hsl(var(--marketing-primary))] rounded-lg shadow-2xl pointer-events-none"
        style={{
          left: step.highlight.x,
          top: step.highlight.y,
          width: step.highlight.width,
          height: step.highlight.height,
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Pulsing glow effect */}
        <motion.div
          className="absolute inset-0 bg-[hsl(var(--marketing-primary))]/20 rounded-lg"
          animate={{
            opacity: [0.2, 0.5, 0.2],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>

      {/* Info tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          className="absolute pointer-events-auto"
          style={{
            left: step.position === 'left' ? `calc(${step.highlight.x} - 320px)` : 
                  step.position === 'right' ? `calc(${step.highlight.x} + ${step.highlight.width} + 20px)` : 
                  step.highlight.x,
            top: step.position === 'top' ? `calc(${step.highlight.y} - 180px)` : 
                 step.position === 'bottom' ? `calc(${step.highlight.y} + ${step.highlight.height} + 20px)` : 
                 step.highlight.y,
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <div className="glass-card p-6 rounded-xl max-w-[300px] border-2 border-[hsl(var(--marketing-primary))]/50 shadow-2xl">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[hsl(var(--marketing-primary))] text-white flex items-center justify-center font-bold text-sm">
                  {step.id}
                </div>
                <h4 className="font-bold text-foreground">{step.title}</h4>
              </div>
              <button
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              {step.description}
            </p>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <span className="text-xs text-muted-foreground">
                  {currentStep + 1} / {tourSteps.length}
                </span>
              </div>

              <Button
                size="sm"
                onClick={handleNext}
                className="gap-2"
              >
                {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                {currentStep < tourSteps.length - 1 && <SkipForward className="h-3 w-3" />}
              </Button>
            </div>

            {/* Progress dots */}
            <div className="flex gap-1 mt-4">
              {tourSteps.map((_, index) => (
                <motion.div
                  key={index}
                  className={`h-1 flex-1 rounded-full ${
                    index === currentStep
                      ? 'bg-[hsl(var(--marketing-primary))]'
                      : index < currentStep
                      ? 'bg-[hsl(var(--marketing-accent))]'
                      : 'bg-muted'
                  }`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
