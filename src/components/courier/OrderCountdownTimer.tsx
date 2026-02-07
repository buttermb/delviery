import { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface OrderCountdownTimerProps {
  orderNumber: string;
  acceptedAt: string;
  onExpire?: () => void;
}

export default function OrderCountdownTimer({ orderNumber, acceptedAt, onExpire }: OrderCountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isWarning, setIsWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const accepted = new Date(acceptedAt);
      const deadline = new Date(accepted.getTime() + 45 * 60 * 1000); // 45 minutes
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('TIME EXPIRED');
        onExpire?.();
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        
        // Warning when less than 10 minutes
        setIsWarning(minutes < 10);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [acceptedAt, onExpire]);

  return (
    <div className={`flex items-center space-x-2 px-3 py-2 rounded border ${
      isExpired ? 'bg-red-500/20 border-red-500 text-red-400' :
      isWarning ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 animate-pulse' :
      'bg-slate-800 border-slate-700 text-slate-300'
    }`}>
      {isExpired ? (
        <AlertCircle size={18} />
      ) : (
        <Clock size={18} />
      )}
      <div className="text-sm">
        <div className="font-bold">{timeLeft}</div>
        <div className="text-xs opacity-80">
          {isExpired ? 'Contact support' : 'to complete'}
        </div>
      </div>
    </div>
  );
}
