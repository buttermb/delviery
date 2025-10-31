import { motion } from 'framer-motion';

interface HeroProps {
  title: string;
  tagline: string;
  totalEntries: number;
  totalParticipants: number;
}

export default function Hero({ title, tagline, totalEntries, totalParticipants }: HeroProps) {
  return (
    <div className="text-center mb-20 relative">
      {/* Live badge */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm rounded-full text-sm font-semibold mb-8 text-emerald-400"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 bg-emerald-400 rounded-full"
        />
        <span className="tracking-wide">LIVE GIVEAWAY</span>
      </motion.div>

      {/* Main title */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="mb-6"
      >
        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-bold mb-2 tracking-tight leading-none">
          <span className="bg-gradient-to-br from-white via-white to-slate-400 text-transparent bg-clip-text">
            {title}
          </span>
        </h1>
      </motion.div>
      
      {/* Tagline */}
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-lg sm:text-xl md:text-2xl text-slate-400 mb-16 max-w-3xl mx-auto font-light"
      >
        {tagline}
      </motion.p>

      {/* Stats */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="flex flex-col sm:flex-row justify-center items-center gap-6 sm:gap-8"
      >
        <div className="group">
          <div className="relative bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl px-10 py-8 hover:border-primary/30 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              className="text-4xl sm:text-5xl font-display font-bold bg-gradient-to-br from-primary to-emerald-400 text-transparent bg-clip-text mb-2"
            >
              {totalEntries.toLocaleString()}
            </motion.div>
            <div className="text-sm text-slate-500 font-medium tracking-wide uppercase">Total Entries</div>
          </div>
        </div>

        <div className="hidden sm:block w-px h-16 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />

        <div className="group">
          <div className="relative bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl px-10 py-8 hover:border-blue-500/30 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
              className="text-4xl sm:text-5xl font-display font-bold bg-gradient-to-br from-blue-400 to-cyan-400 text-transparent bg-clip-text mb-2"
            >
              {totalParticipants.toLocaleString()}
            </motion.div>
            <div className="text-sm text-slate-500 font-medium tracking-wide uppercase">Participants</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
