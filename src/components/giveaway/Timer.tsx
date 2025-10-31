import { motion } from 'framer-motion';
import Countdown from 'react-countdown';
import { Clock } from 'lucide-react';

interface TimerProps {
  endDate: string;
}

export default function Timer({ endDate }: TimerProps) {
  const renderer = ({ days, hours, minutes, seconds, completed }: any) => {
    if (completed) {
      return (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-5xl mx-auto mb-20 text-center"
        >
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-12">
            <div className="text-3xl font-display font-bold text-white">
              Giveaway Ended
            </div>
          </div>
        </motion.div>
      );
    }

    // Determine urgency
    const hoursLeft = days * 24 + hours;
    let urgency;
    if (hoursLeft < 24) {
      urgency = {
        message: 'Less than 24 hours remaining',
        color: 'from-red-500 to-orange-500',
      };
    } else if (hoursLeft < 72) {
      urgency = {
        message: 'Final 3 days',
        color: 'from-orange-500 to-yellow-500',
      };
    } else {
      urgency = {
        message: 'Time remaining',
        color: 'from-primary to-emerald-500',
      };
    }

    const timeValues = [
      { unit: 'days', value: days },
      { unit: 'hours', value: hours },
      { unit: 'minutes', value: minutes },
      { unit: 'seconds', value: seconds }
    ];

    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-5xl mx-auto mb-20"
      >
        {/* Urgency indicator */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 text-slate-400 text-sm font-medium">
            <Clock className="w-4 h-4" />
            <span>{urgency.message}</span>
          </div>
        </div>

        {/* Timer grid */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10 blur-3xl -z-10" />
          
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 sm:p-12">
            <div className="grid grid-cols-4 gap-4 sm:gap-8">
              {timeValues.map(({ unit, value }, index) => (
                <motion.div
                  key={unit}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="text-center"
                >
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-blue-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 sm:p-6 group-hover:border-primary/30 transition-all duration-300">
                      <motion.div
                        key={value}
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold bg-gradient-to-br from-white to-slate-300 text-transparent bg-clip-text mb-2"
                      >
                        {String(value).padStart(2, '0')}
                      </motion.div>
                      <div className="text-xs sm:text-sm text-slate-500 uppercase tracking-widest font-medium">
                        {unit}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Bottom accent line */}
          <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-gradient-to-r ${urgency.color} blur-sm`} />
        </div>
      </motion.div>
    );
  };

  return <Countdown date={new Date(endDate)} renderer={renderer} />;
}

function calculateTimeLeft(endDate: string) {
  const difference = +new Date(endDate) - +new Date();
  
  if (difference > 0) {
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60)
    };
  }
  
  return { days: 0, hours: 0, minutes: 0, seconds: 0 };
}
