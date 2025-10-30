import { motion } from 'framer-motion';
import { UserPlus, Instagram, Mail, Users, CheckCircle2, ShoppingBag } from 'lucide-react';

interface HowToEnterProps {
  giveaway: any;
}

export default function HowToEnter({ giveaway }: HowToEnterProps) {
  const steps = [
    {
      icon: UserPlus,
      title: 'Create Account',
      description: 'Sign up with your email and create your Bud Dash account',
      entries: giveaway.base_entries,
      gradient: 'from-blue-500 to-cyan-500',
      required: true
    },
    {
      icon: Instagram,
      title: 'Follow & Tag',
      description: 'Follow @buddashnyc and tag 2+ friends on Instagram',
      entries: 0,
      gradient: 'from-pink-500 to-purple-500',
      required: true
    },
    {
      icon: ShoppingBag,
      title: 'Make a Purchase',
      description: 'Every completed order automatically earns you bonus entries',
      entries: 5,
      gradient: 'from-violet-500 to-fuchsia-500',
      badge: 'Best Value'
    },
    {
      icon: Mail,
      title: 'Newsletter',
      description: 'Subscribe for exclusive deals and early access',
      entries: giveaway.newsletter_bonus_entries,
      gradient: 'from-emerald-500 to-teal-500',
      badge: 'Bonus'
    },
    {
      icon: Users,
      title: 'Refer Friends',
      description: 'Share your unique link and earn entries per signup',
      entries: giveaway.referral_bonus_entries,
      gradient: 'from-orange-500 to-amber-500',
      badge: 'Unlimited',
      perReferral: true
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
          How to Enter
        </h2>
        <p className="text-slate-500 text-base sm:text-lg font-light">
          Multiple ways to increase your chances of winning
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-12">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={index}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="relative group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${step.gradient} opacity-0 group-hover:opacity-10 rounded-3xl blur-2xl transition-opacity duration-500`} />
              
              <div className="relative bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 hover:border-slate-700 transition-all duration-300 h-full flex flex-col">
                {/* Step number */}
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl flex items-center justify-center font-bold text-sm text-slate-400">
                  {index + 1}
                </div>

                {/* Badge */}
                {(step.required || step.badge) && (
                  <div className={`absolute -top-3 -right-3 px-3 py-1 rounded-full text-xs font-bold ${
                    step.required 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                      : `bg-gradient-to-r ${step.gradient} text-white`
                  }`}>
                    {step.required ? 'Required' : step.badge}
                  </div>
                )}

                {/* Icon */}
                <div className={`w-14 h-14 bg-gradient-to-br ${step.gradient} rounded-2xl flex items-center justify-center mb-5 shadow-lg`}>
                  <Icon className="w-7 h-7 text-white" strokeWidth={2} />
                </div>

                {/* Content */}
                <h3 className="text-lg font-display font-bold mb-2 text-white">
                  {step.title}
                </h3>

                <p className="text-slate-400 text-sm mb-4 flex-grow font-light leading-relaxed">
                  {step.description}
                </p>

                {/* Entries */}
                {step.entries > 0 && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-sm font-semibold text-white">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>+{step.entries} {step.perReferral ? 'per friend' : step.entries === 1 ? 'entry' : 'entries'}</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="max-w-3xl mx-auto"
      >
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-blue-500/20 to-primary/20 rounded-3xl blur-2xl opacity-50" />
          
          <div className="relative bg-slate-900/70 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 text-center">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-emerald-500 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-display font-bold text-white">Maximize Your Chances</h3>
            </div>
            <p className="text-slate-400 mb-6 font-light leading-relaxed">
              Complete all entry methods and refer unlimited friends to earn the most entries
            </p>
            <div className="flex items-center justify-center gap-3 text-xl sm:text-2xl font-display font-bold">
              <span className="bg-gradient-to-br from-primary to-emerald-400 text-transparent bg-clip-text">
                Base: {giveaway.base_entries + giveaway.newsletter_bonus_entries}
              </span>
              <span className="text-slate-600">+</span>
              <span className="bg-gradient-to-br from-orange-400 to-amber-400 text-transparent bg-clip-text">
                Unlimited Referrals
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
