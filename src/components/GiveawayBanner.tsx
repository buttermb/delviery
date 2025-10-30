import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Gift } from 'lucide-react';

export default function GiveawayBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const dismissed = localStorage.getItem('giveaway-banner-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
    
    // Show banner again after 24 hours
    if (dismissed && hoursSinceDismissed < 24) {
      setIsVisible(false);
    }

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('giveaway-banner-dismissed', Date.now().toString());
  };

  if (!isVisible) return null;

  return (
    <div className="relative bg-gradient-to-r from-primary via-emerald-500 to-blue-500 text-white shadow-lg" style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)', paddingBottom: '0.5rem' }}>
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <Link 
            to="/giveaway/nyc-biggest-flower" 
            className="flex-1 flex items-center justify-center gap-2 sm:gap-3 hover:opacity-90 transition-opacity min-w-0 py-1"
          >
            <Gift className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span className="font-bold text-xs sm:text-sm md:text-base leading-tight truncate">
              WIN $4,000 FLOWER
            </span>
            <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium whitespace-nowrap">
              {timeLeft.days}d {timeLeft.hours}h
            </span>
          </Link>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-2 sm:p-2.5 hover:bg-white/20 rounded-full transition-colors touch-manipulation active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Dismiss banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function calculateTimeLeft() {
  const endDate = new Date('2025-12-31T23:59:59');
  const difference = +endDate - +new Date();
  
  if (difference > 0) {
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60)
    };
  }
  
  return { days: 0, hours: 0, minutes: 0 };
}