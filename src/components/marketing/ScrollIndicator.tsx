import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export function ScrollIndicator() {
  const scrollToNext = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: 'smooth',
    });
  };

  return (
    <motion.div
      className="absolute bottom-8 left-0 right-0 flex justify-center cursor-pointer z-20"
      onClick={scrollToNext}
      animate={{ y: [0, 10, 0] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="flex flex-col items-center gap-2 text-white/80 hover:text-white transition-colors">
        <span className="text-sm font-medium">Discover More</span>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
        >
          <ChevronDown className="h-6 w-6" />
        </motion.div>
      </div>
    </motion.div>
  );
}

