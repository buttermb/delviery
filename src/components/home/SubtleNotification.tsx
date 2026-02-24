/**
 * Subtle Notification Component
 * Appears after 30 seconds, easily dismissible
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS } from '@/constants/storageKeys';

export function SubtleNotification() {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has already dismissed
    const dismissed = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_DISMISSED);
    if (dismissed) return;

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 30000); // 30 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATION_DISMISSED, 'true');
  };

  const handleShopNow = () => {
    // Scroll to products section
    const productsSection = document.getElementById('products');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/#products');
    }
    handleDismiss();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20, x: 20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="fixed bottom-8 right-8 z-50 max-w-sm"
        >
          <div className="bg-neutral-900 shadow-2xl rounded-lg p-6 border border-white/20 relative">
            
            {/* Dismiss button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
              aria-label="Dismiss notification"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            
            <div className="pr-6">
              <h4 className="text-lg text-white font-light mb-2">
                Welcome Offer
              </h4>
              <p className="text-white/60 text-sm font-light leading-relaxed mb-4">
                First-time customers receive complimentary delivery 
                on orders over $75.
              </p>
              <button
                onClick={handleShopNow}
                className="px-6 py-2 bg-emerald-600 text-white text-sm font-light hover:bg-emerald-500 transition-colors"
              >
                Shop Now
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

