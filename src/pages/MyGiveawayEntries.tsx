import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Copy, Check, Share2, ArrowLeft, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { GiveawayEntrySkeleton } from '@/components/SkeletonLoader';

interface GiveawayEntry {
  id: string;
  giveaway_id: string;
  total_entries: number;
  base_entries: number;
  newsletter_entries: number;
  referral_entries: number;
  entry_number_start: number;
  entry_number_end: number;
  entered_at: string;
  giveaway: {
    title: string;
    tagline: string;
    slug: string;
    status: string;
    end_date: string;
  };
  referralLink?: string;
  referralStats?: {
    successfulReferrals: number;
    totalBonusEntries: number;
  };
}

export default function MyGiveawayEntries() {
  const [entries, setEntries] = useState<GiveawayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('my-giveaway-entries-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'giveaway_entries'
        },
        () => {
          loadEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadEntries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('giveaway_entries')
        .select(`
          *,
          giveaway:giveaways(title, tagline, slug, status, end_date)
        `)
        .eq('user_id', user.id)
        .order('entered_at', { ascending: false });

      if (error) throw error;

      // Enhance entries with referral data
      const enhancedEntries = await Promise.all(
        (data || []).map(async (entry: any) => {
          // Get referral stats
          const { data: referrals } = await supabase
            .from('giveaway_referrals')
            .select('*')
            .eq('referrer_user_id', user.id)
            .eq('giveaway_id', entry.giveaway_id)
            .eq('converted', true);

          // Get user's referral code
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('referral_code')
            .eq('user_id', user.id)
            .maybeSingle();

          if (profileError) console.error("Profile fetch error:", profileError);
          const referralCode = profile?.referral_code || user.id.slice(0, 8);
          const referralLink = `${window.location.origin}/giveaway/${entry.giveaway.slug}?ref=${referralCode}`;

          return {
            ...entry,
            referralLink,
            referralStats: {
              successfulReferrals: referrals?.length || 0,
              totalBonusEntries: (referrals?.length || 0) * 3
            }
          };
        })
      );

      setEntries(enhancedEntries);
    } catch (error) {
      console.error('Error loading entries:', error);
      toast.error('Failed to load your entries');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = (link: string, entryId: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(entryId);
    toast.success('Referral link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="space-y-4 w-full max-w-lg">
          <GiveawayEntrySkeleton />
          <GiveawayEntrySkeleton />
          <GiveawayEntrySkeleton />
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="max-w-5xl mx-auto px-4">
          <Link 
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          
          <EmptyState
            icon={Gift}
            title="No Giveaway Entries Yet"
            description="Enter our active giveaways for a chance to win amazing prizes!"
            action={{
              label: 'View Giveaways',
              onClick: () => window.location.href = '/giveaway/nyc-biggest-flower'
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-5xl mx-auto px-4">
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-black mb-2">My Giveaway Entries</h1>
          <p className="text-muted-foreground">Track your entries and share to earn more chances to win</p>
        </div>

        {entries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <Trophy className="w-20 h-20 mx-auto mb-6 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-4">No Entries Yet</h2>
            <p className="text-muted-foreground mb-8">
              You haven't entered any giveaways. Check out our current giveaway!
            </p>
            <Link 
              to="/"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              View Current Giveaway
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {entries.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-xl p-6 shadow-lg"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold mb-1">{entry.giveaway.title}</h3>
                    <p className="text-muted-foreground">{entry.giveaway.tagline}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    entry.giveaway.status === 'active' 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                  }`}>
                    {entry.giveaway.status === 'active' ? 'Active' : 'Ended'}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <div className="text-3xl font-black text-primary mb-1">
                      {entry.total_entries}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Entries</div>
                  </div>
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <div className="text-2xl font-bold mb-1">{entry.base_entries}</div>
                    <div className="text-sm text-muted-foreground">Base</div>
                  </div>
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <div className="text-2xl font-bold mb-1">{entry.newsletter_entries}</div>
                    <div className="text-sm text-muted-foreground">Newsletter</div>
                  </div>
                  <div className="bg-background rounded-lg p-4 border border-border">
                    <div className="text-2xl font-bold text-primary mb-1">{entry.referral_entries}</div>
                    <div className="text-sm text-muted-foreground">Referrals</div>
                  </div>
                </div>

                {/* Referral Section - Only show for active giveaways */}
                {entry.giveaway.status === 'active' && entry.referralLink && (
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Share2 className="w-5 h-5 text-primary" />
                      <h4 className="font-bold text-lg">Refer Friends (Unlimited!)</h4>
                    </div>
                    <p className="text-muted-foreground mb-4">+3 entries for each friend who enters</p>

                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={entry.referralLink}
                        readOnly
                        aria-label="Referral link"
                        className="flex-1 bg-background px-4 py-3 rounded-lg text-sm border border-border focus:border-primary focus:outline-none transition-colors"
                        onClick={(e) => e.currentTarget.select()}
                      />
                      <button
                        onClick={() => copyReferralLink(entry.referralLink!, entry.id)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors"
                      >
                        {copiedId === entry.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    {entry.referralStats && entry.referralStats.successfulReferrals > 0 && (
                      <div className="bg-background rounded-lg p-4 border border-border">
                        <div className="text-sm text-muted-foreground">
                          You've referred: <span className="text-primary font-bold">{entry.referralStats.successfulReferrals} friends</span>
                          <span className="text-primary font-bold"> (+{entry.referralStats.totalBonusEntries} entries)</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Entry Details */}
                <div className="mt-6 pt-6 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                  <div>
                    Entered on {new Date(entry.entered_at).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                  <div>
                    Entry #{entry.entry_number_start}
                    {entry.entry_number_end > entry.entry_number_start && ` - #${entry.entry_number_end}`}
                  </div>
                </div>

                {entry.giveaway.status === 'active' && (
                  <Link
                    to={`/giveaway/${entry.giveaway.slug}`}
                    className="mt-4 inline-block text-primary hover:underline font-semibold"
                  >
                    View Giveaway →
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
