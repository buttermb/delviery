import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAutoAnimate } from '@formkit/auto-animate/react';

interface Entry {
  id: string;
  firstName: string;
  borough: string;
  entries: number;
  timeAgo: string;
}

interface LiveFeedProps {
  giveawayId: string;
}

const FAKE_NAMES = ['Sarah', 'Michael', 'Jessica', 'David', 'Emily', 'James', 'Ashley', 'Chris', 'Amanda', 'Matt'];
const FAKE_LAST_INITIALS = ['M', 'R', 'K', 'T', 'L', 'W', 'B', 'P', 'H', 'C'];
const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

// Generate realistic fake entries
const generateFakeEntry = (): Entry => {
  const firstName = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
  const lastInitial = FAKE_LAST_INITIALS[Math.floor(Math.random() * FAKE_LAST_INITIALS.length)];
  const borough = BOROUGHS[Math.floor(Math.random() * BOROUGHS.length)];
  
  // Weighted toward 1-3 entries (70%), some higher (30%)
  const rand = Math.random();
  const entries = rand < 0.4 ? 1 : rand < 0.7 ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 10) + 3;
  
  // Recent timestamps (within last 30 minutes)
  const minutesAgo = Math.floor(Math.random() * 30);
  const timeAgo = minutesAgo === 0 ? 'just now' : 
                  minutesAgo === 1 ? '1 minute ago' : 
                  `${minutesAgo} minutes ago`;
  
  return {
    id: `fake-${Date.now()}-${Math.random()}`,
    firstName: `${firstName} ${lastInitial}.`,
    borough,
    entries,
    timeAgo
  };
};

export function LiveFeed({ giveawayId }: LiveFeedProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [parent] = useAutoAnimate();

  useEffect(() => {
    loadEntries();
    
    // Auto-refresh every 15 seconds
    const interval = setInterval(loadEntries, 15000);
    return () => clearInterval(interval);
  }, [giveawayId]);

  const loadEntries = async () => {
    try {
      // Get real entries
      const { data: realEntries, error } = await supabase
        .from('giveaway_entries')
        .select('user_first_name, user_last_name, user_borough, total_entries, entered_at')
        .eq('giveaway_id', giveawayId)
        .order('entered_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Format real entries
      const formatted: Entry[] = (realEntries || []).map(entry => ({
        id: `real-${entry.entered_at}`,
        firstName: `${entry.user_first_name} ${entry.user_last_name[0]}.`,
        borough: entry.user_borough || 'NYC',
        entries: entry.total_entries,
        timeAgo: formatTimeAgo(entry.entered_at)
      }));

      // Mix with fake entries (60% fake for better social proof when starting)
      const minEntries = 15; // Always show at least 15 entries
      const fakeRatio = formatted.length < 5 ? 0.8 : 0.6; // More fake entries if we have few real ones
      
      let allEntries = [...formatted];
      
      // Add fake entries to reach minimum or maintain ratio
      while (allEntries.length < minEntries || (formatted.length > 0 && allEntries.length < formatted.length / (1 - fakeRatio))) {
        allEntries.push(generateFakeEntry());
      }
      
      // Shuffle to mix real and fake naturally
      allEntries = allEntries.sort(() => Math.random() - 0.5);

      setEntries(allEntries.slice(0, 15)); // Show 15 entries
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-blue-500 to-cyan-500',
      'from-emerald-500 to-teal-500',
      'from-purple-500 to-pink-500',
      'from-orange-500 to-amber-500',
      'from-indigo-500 to-purple-500',
      'from-rose-500 to-pink-500'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-800 rounded w-1/3" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-slate-800 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 bg-emerald-400 rounded-full"
          />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Live Activity</span>
        </div>
        <Activity className="w-4 h-4 text-emerald-400" />
      </div>

      <h3 className="text-2xl font-display font-bold mb-6 text-white">
        Recent Entries
      </h3>

      <div ref={parent} className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent pr-2">
        {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative flex items-center gap-4 p-4 bg-slate-800/30 border border-slate-700/30 rounded-2xl hover:border-slate-600/50 transition-all duration-300">
                <div className={`w-11 h-11 bg-gradient-to-br ${getAvatarColor(entry.firstName)} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  {entry.firstName[0]}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm truncate">
                    {entry.firstName}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{entry.borough}</span>
                    <span className="text-slate-700">•</span>
                    <span>{entry.timeAgo}</span>
                  </div>
                </div>
                
                <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <span className="text-emerald-400 font-bold text-sm">+{entry.entries}</span>
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="mt-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-xl">
          <span className="text-sm font-medium text-slate-400">
            Entries updating in real-time
          </span>
        </div>
      </div>
    </div>
  );
}
