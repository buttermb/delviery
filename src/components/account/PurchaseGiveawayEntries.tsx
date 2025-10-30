import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, Gift, Trophy, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PurchaseGiveawayEntries() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEntries: 0,
    manualEntries: 0,
    purchaseEntries: 0,
    verified: 0
  });

  useEffect(() => {
    fetchEntries();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('giveaway-entries-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'giveaway_entries'
        },
        () => {
          fetchEntries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEntries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch entries by user_id
      const { data, error } = await supabase
        .from('giveaway_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('entered_at', { ascending: false });

      if (error) throw error;

      setEntries(data || []);

      // Calculate stats
      const stats = {
        totalEntries: data?.reduce((sum, e) => sum + e.total_entries, 0) || 0,
        manualEntries: data?.filter(e => e.entry_type === 'manual').length || 0,
        purchaseEntries: data?.filter(e => e.entry_type === 'purchase').length || 0,
        verified: data?.filter(e => e.status === 'verified').length || 0
      };
      setStats(stats);

    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Entries</p>
                  <p className="text-2xl font-bold">{stats.totalEntries}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <ShoppingBag className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Entries</p>
                  <p className="text-2xl font-bold">{stats.purchaseEntries}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <Gift className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Manual Entries</p>
                  <p className="text-2xl font-bold">{stats.manualEntries}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <CheckCircle2 className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Verified</p>
                  <p className="text-2xl font-bold">{stats.verified}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Entries List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Your Giveaway Entries
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            🛍️ Earn 5 entries for every purchase! | 🎟️ Manual entries give you 1 entry
          </p>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Entries Yet</h3>
              <p className="text-muted-foreground mb-6">
                Make a purchase to automatically earn 5 giveaway entries!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex justify-between items-center p-4 bg-card border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${
                      entry.entry_type === 'purchase' 
                        ? 'bg-green-500/10' 
                        : 'bg-blue-500/10'
                    }`}>
                      {entry.entry_type === 'purchase' ? (
                        <ShoppingBag className="w-5 h-5 text-green-500" />
                      ) : (
                        <Gift className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {entry.entry_type === 'purchase' 
                          ? '🛍️ Purchase Entry' 
                          : '🎟️ Manual Entry'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Entry #{entry.entry_number_start}-{entry.entry_number_end} • {entry.total_entries} entries
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.entered_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={entry.status === 'verified' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {entry.status}
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}