import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface Entry {
  name: string;
  borough: string;
  entries: number;
}

const FAKE_NAMES = [
  { first: 'Sarah', last: 'M.' },
  { first: 'Mike', last: 'R.' },
  { first: 'Jessica', last: 'L.' },
  { first: 'David', last: 'K.' },
  { first: 'Emily', last: 'W.' },
  { first: 'Chris', last: 'P.' },
  { first: 'Amanda', last: 'S.' },
  { first: 'Tyler', last: 'B.' },
  { first: 'Nicole', last: 'H.' },
  { first: 'Brandon', last: 'G.' }
];

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

const generateEntry = (): Entry => {
  const person = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
  const borough = BOROUGHS[Math.floor(Math.random() * BOROUGHS.length)];
  const entries = Math.random() < 0.7 ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 8) + 3;
  
  return {
    name: `${person.first} ${person.last}`,
    borough,
    entries
  };
};

export function RecentEntryPopup() {
  const [currentEntry, setCurrentEntry] = useState<Entry | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const showNotification = () => {
      setCurrentEntry(generateEntry());
      setShow(true);
      
      setTimeout(() => {
        setShow(false);
      }, 4000);
    };

    // Show first notification after 3-8 seconds
    const initialDelay = 3000 + Math.random() * 5000;
    const initialTimer = setTimeout(showNotification, initialDelay);

    // Then show every 8-15 seconds
    const interval = setInterval(() => {
      showNotification();
    }, 8000 + Math.random() * 7000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <AnimatePresence>
      {show && currentEntry && (
        <motion.div
          initial={{ x: -400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -400, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          className="fixed bottom-6 left-6 z-50 max-w-sm"
        >
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white text-sm truncate">
                    {currentEntry.name}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <span className="text-emerald-400 font-bold text-xs">+{currentEntry.entries}</span>
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  from {currentEntry.borough} just entered
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
