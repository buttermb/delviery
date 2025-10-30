import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Users, Award, TrendingUp, Download, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface Giveaway {
  id: string;
  title: string;
  total_entries: number;
  total_participants: number;
}

interface EntrySource {
  base: number;
  newsletter: number;
  story: number;
  post: number;
  referral: number;
}

interface TopReferrer {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  referral_count: number;
  entries_awarded: number;
}

interface RecentEntry {
  first_name: string;
  last_name: string;
  borough: string;
  total_entries: number;
  entered_at: string;
}

export default function AdminGiveawayAnalytics() {
  const { id } = useParams();
  const [giveaway, setGiveaway] = useState<Giveaway | null>(null);
  const [entrySources, setEntrySources] = useState<EntrySource>({
    base: 0,
    newsletter: 0,
    story: 0,
    post: 0,
    referral: 0
  });
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
    
    // Auto-refresh recent entries every 10 seconds
    const interval = setInterval(loadRecentEntries, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const loadAnalytics = async () => {
    try {
      // Load giveaway
      const { data: giveawayData, error: giveawayError } = await supabase
        .from('giveaways')
        .select('*')
        .eq('id', id)
        .single();

      if (giveawayError) throw giveawayError;
      setGiveaway(giveawayData);

      // Load entry sources
      const { data: entries, error: entriesError } = await supabase
        .from('giveaway_entries')
        .select('base_entries, newsletter_entries, instagram_story_entries, instagram_post_entries, referral_entries')
        .eq('giveaway_id', id);

      if (entriesError) throw entriesError;

      const sources = entries.reduce((acc, entry) => ({
        base: acc.base + (entry.base_entries || 0),
        newsletter: acc.newsletter + (entry.newsletter_entries || 0),
        story: acc.story + (entry.instagram_story_entries || 0),
        post: acc.post + (entry.instagram_post_entries || 0),
        referral: acc.referral + (entry.referral_entries || 0)
      }), { base: 0, newsletter: 0, story: 0, post: 0, referral: 0 });

      setEntrySources(sources);

      // Load top referrers
      const { data: referrals, error: referralsError } = await supabase
        .from('giveaway_referrals')
        .select(`
          referrer_user_id,
          entries_awarded
        `)
        .eq('giveaway_id', id)
        .eq('converted', true);

      if (referralsError) throw referralsError;

      // Group by referrer
      const referrerMap = new Map();
      referrals.forEach(ref => {
        const current = referrerMap.get(ref.referrer_user_id) || { count: 0, entries: 0 };
        referrerMap.set(ref.referrer_user_id, {
          count: current.count + 1,
          entries: current.entries + (ref.entries_awarded || 0)
        });
      });

      // Get user details for top referrers
      const topReferrerIds = Array.from(referrerMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([id]) => id);

      if (topReferrerIds.length > 0) {
        const { data: entryData } = await supabase
          .from('giveaway_entries')
          .select('user_id, user_first_name, user_last_name, user_email')
          .in('user_id', topReferrerIds)
          .eq('giveaway_id', id);

        const referrersWithDetails = entryData?.map(entry => {
          const stats = referrerMap.get(entry.user_id);
          return {
            user_id: entry.user_id,
            first_name: entry.user_first_name,
            last_name: entry.user_last_name,
            email: entry.user_email,
            referral_count: stats.count,
            entries_awarded: stats.entries
          };
        }).sort((a, b) => b.referral_count - a.referral_count) || [];

        setTopReferrers(referrersWithDetails);
      }

      await loadRecentEntries();

    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentEntries = async () => {
    const { data, error } = await supabase
      .from('giveaway_entries')
      .select('user_first_name, user_last_name, user_borough, total_entries, entered_at')
      .eq('giveaway_id', id)
      .order('entered_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setRecentEntries(data.map(entry => ({
        first_name: entry.user_first_name,
        last_name: entry.user_last_name,
        borough: entry.user_borough,
        total_entries: entry.total_entries,
        entered_at: entry.entered_at
      })));
    }
  };

  const exportEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('giveaway_entries')
        .select('*')
        .eq('giveaway_id', id)
        .order('entered_at', { ascending: false });

      if (error) throw error;

      // Create CSV
      const headers = ['Entry #', 'Name', 'Email', 'Phone', 'Borough', 'Instagram', 'Total Entries', 'Base', 'Newsletter', 'Story', 'Post', 'Referrals', 'Status', 'Entered At'];
      const rows = data.map(entry => [
        entry.entry_number_start,
        `${entry.user_first_name} ${entry.user_last_name}`,
        entry.user_email,
        entry.user_phone || '',
        entry.user_borough || '',
        entry.instagram_handle || '',
        entry.total_entries,
        entry.base_entries,
        entry.newsletter_entries,
        entry.instagram_story_entries,
        entry.instagram_post_entries,
        entry.referral_entries,
        entry.status,
        new Date(entry.entered_at).toLocaleString()
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `giveaway-entries-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Entries exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export entries');
    }
  };

  const totalEntries = Object.values(entrySources).reduce((a, b) => a + b, 0);
  const avgPerUser = giveaway?.total_participants ? (giveaway.total_entries / giveaway.total_participants).toFixed(1) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Award className="w-12 h-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!giveaway) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Giveaway not found</p>
          <Link to="/admin/giveaways">
            <Button variant="outline" className="mt-4">Back to Giveaways</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/giveaways">
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black">{giveaway.title}</h1>
            <p className="text-muted-foreground">Analytics Dashboard</p>
          </div>
        </div>
        <Button onClick={exportEntries} className="gap-2">
          <Download className="w-4 h-4" />
          Export Entries
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Total Participants</span>
          </div>
          <div className="text-3xl font-bold text-blue-500">
            {giveaway.total_participants.toLocaleString()}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Award className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Total Entries</span>
          </div>
          <div className="text-3xl font-bold text-green-500">
            {giveaway.total_entries.toLocaleString()}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-sm text-muted-foreground">Avg per User</span>
          </div>
          <div className="text-3xl font-bold text-purple-500">
            {avgPerUser}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Trophy className="w-5 h-5 text-orange-500" />
            </div>
            <span className="text-sm text-muted-foreground">Verification Rate</span>
          </div>
          <div className="text-3xl font-bold text-orange-500">
            100%
          </div>
        </Card>
      </div>

      {/* Entry Sources Breakdown */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Entry Sources Breakdown</h2>
        <div className="space-y-4">
          {[
            { label: 'Base Entries', value: entrySources.base, color: 'bg-blue-500' },
            { label: 'Newsletter Bonus', value: entrySources.newsletter, color: 'bg-green-500' },
            { label: 'Instagram Story', value: entrySources.story, color: 'bg-pink-500' },
            { label: 'Instagram Post', value: entrySources.post, color: 'bg-purple-500' },
            { label: 'Referral Bonus', value: entrySources.referral, color: 'bg-orange-500' }
          ].map(source => {
            const percentage = totalEntries > 0 ? (source.value / totalEntries) * 100 : 0;
            return (
              <div key={source.label}>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">{source.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {source.value.toLocaleString()} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Top Referrers */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Top Referrers Leaderboard 🏆</h2>
        <div className="space-y-3">
          {topReferrers.map((referrer, index) => (
            <div
              key={referrer.user_id}
              className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
            >
              <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${
                index === 0 ? 'bg-yellow-500 text-yellow-900' :
                index === 1 ? 'bg-gray-400 text-gray-900' :
                index === 2 ? 'bg-orange-600 text-orange-100' :
                'bg-muted-foreground/20'
              }`}>
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
              </div>
              <div className="flex-1">
                <div className="font-semibold">
                  {referrer.first_name} {referrer.last_name}
                </div>
                <div className="text-sm text-muted-foreground">{referrer.email}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-primary">{referrer.referral_count} referrals</div>
                <div className="text-sm text-muted-foreground">+{referrer.entries_awarded} entries</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Entries */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <h2 className="text-xl font-bold">LIVE Recent Entries</h2>
          <span className="text-sm text-muted-foreground">(auto-updates every 10s)</span>
        </div>
        <div className="space-y-3">
          {recentEntries.map((entry, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg animate-in slide-in-from-left"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                {entry.first_name[0]}
              </div>
              <div className="flex-1">
                <div className="font-medium">
                  {entry.first_name} {entry.last_name[0]}. from {entry.borough}
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(entry.entered_at).toLocaleString()}
                </div>
              </div>
              <div className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm font-medium">
                +{entry.total_entries}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
