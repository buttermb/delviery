import { motion } from 'framer-motion';
import { Trophy, DollarSign, Gift } from 'lucide-react';

interface PrizeCardsProps {
  giveaway: any;
}

export default function PrizeCards({ giveaway }: PrizeCardsProps) {
  const prizes = [
    {
      rank: '1st',
      icon: Trophy,
      title: giveaway.grand_prize_title,
      description: giveaway.grand_prize_description,
      value: giveaway.grand_prize_value,
      gradient: 'from-amber-400 to-yellow-600',
      iconBg: 'from-amber-500/20 to-yellow-500/20',
      borderColor: 'border-amber-500/20 hover:border-amber-500/40'
    },
    {
      rank: '2nd',
      icon: DollarSign,
      title: giveaway.second_prize_title,
      description: 'Store credit for your next order',
      value: giveaway.second_prize_value,
      gradient: 'from-slate-300 to-slate-500',
      iconBg: 'from-slate-400/20 to-slate-500/20',
      borderColor: 'border-slate-500/20 hover:border-slate-500/40'
    },
    {
      rank: '3rd',
      icon: Gift,
      title: giveaway.third_prize_title,
      description: 'Store credit for any product',
      value: giveaway.third_prize_value,
      gradient: 'from-orange-400 to-orange-600',
      iconBg: 'from-orange-500/20 to-orange-600/20',
      borderColor: 'border-orange-500/20 hover:border-orange-500/40'
    }
  ];

  return (
    <div className="mb-20">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-4 bg-gradient-to-br from-white to-slate-400 text-transparent bg-clip-text">
          Three Winners. ${(giveaway.grand_prize_value + giveaway.second_prize_value + giveaway.third_prize_value).toLocaleString()}+ in Prizes
        </h2>
        <p className="text-slate-500 text-base sm:text-lg font-light">
          Winners announced {new Date(giveaway.end_date).toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric',
            year: 'numeric'
          })}
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {prizes.map((prize, index) => {
          const Icon = prize.icon;
          return (
            <motion.div
              key={index}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              whileHover={{ y: -4 }}
              className="relative group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${prize.iconBg} rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              
              <div className={`relative bg-slate-900/50 backdrop-blur-xl border ${prize.borderColor} rounded-3xl p-8 transition-all duration-300`}>
                {/* Rank indicator */}
                <div className={`absolute -top-3 -right-3 w-14 h-14 bg-gradient-to-br ${prize.gradient} rounded-2xl flex items-center justify-center font-display font-bold text-lg shadow-xl transform rotate-12 group-hover:rotate-0 transition-transform duration-300`}>
                  {prize.rank}
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 bg-gradient-to-br ${prize.iconBg} backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 border border-white/5`}>
                  <Icon className={`w-8 h-8 bg-gradient-to-br ${prize.gradient} text-transparent bg-clip-text`} strokeWidth={2.5} />
                </div>

                {/* Title */}
                <h3 className="text-xl sm:text-2xl font-display font-bold mb-2 text-white">
                  {prize.title}
                </h3>
                
                {/* Description */}
                <p className="text-slate-400 text-sm mb-6 font-light leading-relaxed">
                  {prize.description}
                </p>

                {/* Value */}
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl sm:text-5xl font-display font-bold bg-gradient-to-br ${prize.gradient} text-transparent bg-clip-text`}>
                    ${prize.value.toLocaleString()}
                  </span>
                  <span className="text-slate-600 text-sm font-medium uppercase tracking-wider">
                    value
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
