import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getGiveaway, getUserEntry } from '@/lib/api/giveaway';
import Hero from '@/components/giveaway/Hero';
import Timer from '@/components/giveaway/Timer';
import EntryForm from '@/components/giveaway/EntryForm';
import EntryStatus from '@/components/giveaway/EntryStatus';
import PrizeCards from '@/components/giveaway/PrizeCards';
import HowToEnter from '@/components/giveaway/HowToEnter';
import { LiveFeed } from '@/components/giveaway/LiveFeed';
import { SocialProofIndicators } from '@/components/giveaway/SocialProofIndicators';
import { RecentEntryPopup } from '@/components/giveaway/RecentEntryPopup';
import GiveawayHeader from '@/components/giveaway/GiveawayHeader';
import BackToHomeButton from '@/components/giveaway/BackToHomeButton';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GiveawayPage() {
  const [searchParams] = useSearchParams();
  const { slug } = useParams<{ slug: string }>();
  const [user, setUser] = useState<any>(null);
  
  const [giveaway, setGiveaway] = useState<any>(null);
  const [userEntry, setUserEntry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const referralCode = searchParams.get('ref');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadGiveaway();
  }, [user]);

  async function loadGiveaway() {
    try {
      const giveawayData = await getGiveaway(slug || 'nyc-biggest-flower');
      setGiveaway(giveawayData);

      if (giveawayData && user) {
        const userEntryData = await getUserEntry(giveawayData.id, user.id);
        setUserEntry(userEntryData);
      }
    } catch (error) {
      console.error('Error loading giveaway:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-12 h-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!giveaway) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4 text-white font-display">Giveaway Not Found</h1>
          <p className="text-slate-400">This giveaway doesn't exist or has ended.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden font-sans">
      {/* Header Navigation */}
      <GiveawayHeader />
      
      {/* Floating Back Button */}
      <BackToHomeButton />
      
      {/* Social proof popup */}
      <RecentEntryPopup />
      
      {/* Elegant gradient mesh background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      </div>

      <div className="relative container mx-auto px-4 sm:px-6 py-12 sm:py-20 max-w-7xl">
        <Hero
          title={giveaway.title}
          tagline={giveaway.tagline}
          totalEntries={giveaway.total_entries}
          totalParticipants={giveaway.total_participants}
        />

        <SocialProofIndicators totalEntries={giveaway.total_entries} />

        <Timer endDate={giveaway.end_date} />

        {userEntry ? (
          <EntryStatus
            entry={userEntry}
            giveaway={giveaway}
            onUpdate={loadGiveaway}
          />
        ) : (
          <EntryForm
            giveaway={giveaway}
            referralCode={referralCode || undefined}
            onSuccess={loadGiveaway}
          />
        )}

        <PrizeCards giveaway={giveaway} />
        <HowToEnter giveaway={giveaway} />
        <LiveFeed giveawayId={giveaway.id} />
      </div>
    </div>
  );
}
