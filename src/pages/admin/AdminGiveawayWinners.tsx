import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Trophy, Mail, Phone, CheckCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function AdminGiveawayWinners() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [giveaway, setGiveaway] = useState<any>(null);
  const [winners, setWinners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [hasWinners, setHasWinners] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      // Load giveaway
      const { data: giveawayData, error: giveawayError } = await supabase
        .from('giveaways')
        .select('*')
        .eq('id', id)
        .single();

      if (giveawayError) throw giveawayError;
      setGiveaway(giveawayData);

      // Check for existing winners
      const { data: winnersData, error: winnersError } = await supabase
        .from('giveaway_winners')
        .select(`
          *,
          profiles!giveaway_winners_user_id_fkey (
            full_name,
            phone
          ),
          giveaway_entries!giveaway_winners_entry_id_fkey (
            user_email,
            user_first_name,
            user_last_name,
            user_phone
          )
        `)
        .eq('giveaway_id', id)
        .order('prize_rank');

      if (!winnersError && winnersData && winnersData.length > 0) {
        setWinners(winnersData);
        setHasWinners(true);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectWinners = async () => {
    if (!giveaway) return;
    
    setSelecting(true);
    try {
      // Get all verified entries
      const { data: entries, error: entriesError } = await supabase
        .from('giveaway_entries')
        .select('*')
        .eq('giveaway_id', id)
        .eq('status', 'verified')
        .order('entry_number_start');

      if (entriesError) throw entriesError;

      if (!entries || entries.length < 3) {
        throw new Error('Not enough entries to select 3 winners');
      }

      // Build entry number pool
      const entryPool: Array<{ entryNumber: number; entryId: string; userId: string }> = [];
      entries.forEach(entry => {
        for (let i = entry.entry_number_start!; i <= entry.entry_number_end!; i++) {
          entryPool.push({
            entryNumber: i,
            entryId: entry.id,
            userId: entry.user_id!
          });
        }
      });

      // Select 3 unique winners
      const selectedWinners: any[] = [];
      const usedUserIds = new Set<string>();
      
      const prizes = [
        { rank: 1, title: giveaway.grand_prize_title, value: giveaway.grand_prize_value },
        { rank: 2, title: giveaway.second_prize_title, value: giveaway.second_prize_value },
        { rank: 3, title: giveaway.third_prize_title, value: giveaway.third_prize_value }
      ];

      for (const prize of prizes) {
        let attempts = 0;
        let winner;
        
        // Try to find a unique winner
        while (attempts < 100) {
          const randomIndex = Math.floor(Math.random() * entryPool.length);
          const selection = entryPool[randomIndex];
          
          if (!usedUserIds.has(selection.userId)) {
            winner = selection;
            usedUserIds.add(selection.userId);
            break;
          }
          attempts++;
        }

        if (!winner) {
          throw new Error('Could not select unique winners');
        }

        // Find the entry details
        const entryDetails = entries.find(e => e.id === winner.entryId);
        
        selectedWinners.push({
          giveaway_id: id,
          user_id: winner.userId,
          entry_id: winner.entryId,
          prize_rank: prize.rank,
          prize_title: prize.title,
          prize_value: prize.value,
          winning_entry_number: winner.entryNumber,
          status: 'pending',
          notified_at: new Date().toISOString()
        });
      }

      // Insert winners
      const { error: insertError } = await supabase
        .from('giveaway_winners')
        .insert(selectedWinners);

      if (insertError) throw insertError;

      // Update giveaway status
      await supabase
        .from('giveaways')
        .update({ status: 'winners_selected' })
        .eq('id', id);

      toast.success('Winners selected successfully!');
      await loadData();
    } catch (error: any) {
      console.error('Error selecting winners:', error);
      toast.error(error.message);
    } finally {
      setSelecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const getRankBadge = (rank: number) => {
    const badges = {
      1: { emoji: '🥇', color: 'from-yellow-500 to-amber-600' },
      2: { emoji: '🥈', color: 'from-gray-400 to-gray-500' },
      3: { emoji: '🥉', color: 'from-orange-500 to-orange-600' }
    };
    return badges[rank as keyof typeof badges];
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/admin/giveaways')}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Giveaways
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{giveaway?.title}</h1>
        <p className="text-muted-foreground">Winner Selection</p>
      </div>

      {!hasWinners ? (
        <>
          <Alert className="mb-6 border-amber-500 bg-amber-50">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <AlertDescription className="text-amber-900">
              <strong>IMPORTANT:</strong> This action cannot be undone. Winners will be randomly selected and automatically notified via email.
            </AlertDescription>
          </Alert>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Eligible Entries Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Participants</p>
                  <p className="text-2xl font-bold">{giveaway?.total_participants || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Entries</p>
                  <p className="text-2xl font-bold">{giveaway?.total_entries || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Average per User</p>
                  <p className="text-2xl font-bold">
                    {giveaway?.total_participants > 0 
                      ? (giveaway.total_entries / giveaway.total_participants).toFixed(1)
                      : '0'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="text-2xl font-bold capitalize">{giveaway?.status}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Prize Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg">
                <span className="text-3xl">🥇</span>
                <div className="flex-1">
                  <p className="font-semibold">{giveaway?.grand_prize_title}</p>
                  <p className="text-sm text-muted-foreground">{giveaway?.grand_prize_description}</p>
                </div>
                <p className="text-xl font-bold text-yellow-600">
                  ${giveaway?.grand_prize_value?.toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
                <span className="text-3xl">🥈</span>
                <div className="flex-1">
                  <p className="font-semibold">{giveaway?.second_prize_title}</p>
                </div>
                <p className="text-xl font-bold text-gray-600">
                  ${giveaway?.second_prize_value?.toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg">
                <span className="text-3xl">🥉</span>
                <div className="flex-1">
                  <p className="font-semibold">{giveaway?.third_prize_title}</p>
                </div>
                <p className="text-xl font-bold text-orange-600">
                  ${giveaway?.third_prize_value?.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selection Process</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                <p className="text-sm text-muted-foreground">What happens when you click the button:</p>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Three random entry numbers will be selected from the pool</li>
                  <li>Winners are matched to their entry ranges</li>
                  <li>Same person cannot win multiple prizes</li>
                  <li>Winners are saved to the database</li>
                  <li>Notification emails are queued for sending</li>
                  <li>Winners have 72 hours to claim their prizes</li>
                </ul>
              </div>

              <Button
                onClick={selectWinners}
                disabled={selecting || (giveaway?.total_participants || 0) < 3}
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {selecting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Selecting Winners...
                  </>
                ) : (
                  <>
                    <Trophy className="w-5 h-5 mr-2" />
                    🎲 SELECT WINNERS NOW
                  </>
                )}
              </Button>

              {(giveaway?.total_participants || 0) < 3 && (
                <p className="text-sm text-amber-600 mt-2 text-center">
                  Need at least 3 participants to select winners
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="space-y-6">
          <Alert className="border-emerald-500 bg-emerald-50">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <AlertDescription className="text-emerald-900">
              Winners have been selected and notified via email. They have 72 hours to claim their prizes.
            </AlertDescription>
          </Alert>

          {winners.map((winner) => {
            const badge = getRankBadge(winner.prize_rank);
            const entryData = winner.giveaway_entries;
            
            return (
              <motion.div
                key={winner.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: winner.prize_rank * 0.1 }}
              >
                <Card className={`border-2 bg-gradient-to-r ${badge.color} bg-opacity-5`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{badge.emoji}</span>
                      <div>
                        <CardTitle className="text-xl">
                          {winner.prize_rank === 1 ? '1ST' : winner.prize_rank === 2 ? '2ND' : '3RD'} PLACE WINNER
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Entry #{winner.winning_entry_number?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Winner Name</p>
                        <p className="font-semibold">
                          {entryData?.user_first_name} {entryData?.user_last_name}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Prize</p>
                        <p className="font-semibold">{winner.prize_title}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email
                        </p>
                        <p className="font-mono text-sm">{entryData?.user_email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          Phone
                        </p>
                        <p className="font-mono text-sm">{entryData?.user_phone}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="font-semibold capitalize">{winner.status}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Prize Value</p>
                        <p className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                          ${winner.prize_value?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
