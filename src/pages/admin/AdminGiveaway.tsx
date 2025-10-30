import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { safeUpperCase, capitalize } from '@/utils/stringHelpers';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, TrendingUp, Download, Shuffle, List } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

export default function AdminGiveaway() {
  const [giveaway, setGiveaway] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load active giveaway
      const { data: giveawayData } = await supabase
        .from('giveaways')
        .select('*')
        .eq('status', 'active')
        .single();

      setGiveaway(giveawayData);

      if (giveawayData) {
        // Load all entries
        const { data: entriesData } = await supabase
          .from('giveaway_entries')
          .select('*')
          .eq('giveaway_id', giveawayData.id)
          .order('entered_at', { ascending: false });

        setEntries(entriesData || []);

        // Load winners
        const { data: winnersData } = await supabase
          .from('giveaway_winners')
          .select('*, giveaway_entries(*)')
          .eq('giveaway_id', giveawayData.id);

        setWinners(winnersData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function selectWinners() {
    if (!giveaway) return;

    try {
      const totalEntries = giveaway.total_entries;
      const winningNumbers = [];

      // Select 3 random winning numbers
      for (let rank = 1; rank <= 3; rank++) {
        let winningNumber;
        do {
          winningNumber = Math.floor(Math.random() * totalEntries) + 1;
        } while (winningNumbers.includes(winningNumber));
        winningNumbers.push(winningNumber);

        // Find the entry with this number
        const winner = entries.find(
          (e) => winningNumber >= e.entry_number_start && winningNumber <= e.entry_number_end
        );

        if (winner) {
          const prizeConfig = {
            1: {
              title: giveaway.grand_prize_title,
              value: giveaway.grand_prize_value,
              credit: 0,
            },
            2: {
              title: giveaway.second_prize_title,
              value: giveaway.second_prize_value,
              credit: 200,
            },
            3: {
              title: giveaway.third_prize_title,
              value: giveaway.third_prize_value,
              credit: 50,
            },
          };

          const prize = prizeConfig[rank as 1 | 2 | 3];

          await supabase.from('giveaway_winners').insert({
            giveaway_id: giveaway.id,
            user_id: winner.user_id,
            entry_id: winner.id,
            prize_rank: rank,
            prize_title: prize.title,
            prize_value: prize.value,
            winning_entry_number: winningNumber,
            credit_amount: prize.credit,
            credit_code: prize.credit > 0 ? generateCreditCode() : null,
          });
        }
      }

      toast({
        title: 'Winners Selected! 🎉',
        description: '3 winners have been randomly selected.',
      });

      loadData();
    } catch (error) {
      console.error('Error selecting winners:', error);
      toast({
        title: 'Error',
        description: 'Failed to select winners',
        variant: 'destructive',
      });
    }
  }

  function generateCreditCode() {
    return 'BUDDASH-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }

  async function exportEntries() {
    const csv = [
      ['Email', 'First Name', 'Last Name', 'Phone', 'Borough', 'Instagram', 'Total Entries', 'Entry Numbers', 'Entered At'],
      ...entries.map((e) => [
        e.user_email,
        e.user_first_name,
        e.user_last_name,
        e.user_phone,
        e.user_borough,
        e.instagram_handle,
        e.total_entries,
        `${e.entry_number_start}-${e.entry_number_end}`,
        new Date(e.entered_at).toLocaleString(),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `giveaway-entries-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  if (loading) return <div className="p-8">Loading...</div>;
  if (!giveaway) return <div className="p-8">No active giveaway</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-bold">{giveaway.title}</h1>
            <Badge variant={giveaway.status === 'active' ? 'default' : 'secondary'} className="text-sm">
              {safeUpperCase(giveaway.status || 'active')}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Ends: {new Date(giveaway.end_date).toLocaleDateString()}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = '/admin/giveaways'}>
          View All Giveaways
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Entries</p>
              <p className="text-3xl font-bold">{giveaway.total_entries.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Participants</p>
              <p className="text-3xl font-bold">{giveaway.total_participants.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <Trophy className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Winners Selected</p>
              <p className="text-3xl font-bold">{winners.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-4">
        <Button onClick={selectWinners} disabled={winners.length > 0}>
          <Shuffle className="w-4 h-4 mr-2" />
          Select Winners
        </Button>
        <Button onClick={exportEntries} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Entries
        </Button>
      </div>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">All Entries ({entries.length})</TabsTrigger>
          <TabsTrigger value="winners">Winners ({winners.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="space-y-4">
          <Card>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Name</th>
                      <th className="text-left py-3 px-4">Email</th>
                      <th className="text-left py-3 px-4">Borough</th>
                      <th className="text-left py-3 px-4">Instagram</th>
                      <th className="text-left py-3 px-4">Entries</th>
                      <th className="text-left py-3 px-4">Entry #s</th>
                      <th className="text-left py-3 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          {entry.user_first_name} {entry.user_last_name}
                        </td>
                        <td className="py-3 px-4">{entry.user_email}</td>
                        <td className="py-3 px-4">{entry.user_borough}</td>
                        <td className="py-3 px-4">@{entry.instagram_handle}</td>
                        <td className="py-3 px-4">
                          <Badge>{entry.total_entries}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {entry.entry_number_start}-{entry.entry_number_end}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(entry.entered_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="winners" className="space-y-4">
          {winners.length === 0 ? (
            <Card className="p-12 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-bold mb-2">No Winners Selected Yet</h3>
              <p className="text-muted-foreground mb-4">Click "Select Winners" to randomly choose 3 winners</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {winners.map((winner) => (
                <Card key={winner.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div
                        className={`p-3 rounded-lg ${
                          winner.prize_rank === 1
                            ? 'bg-yellow-500/10'
                            : winner.prize_rank === 2
                            ? 'bg-gray-400/10'
                            : 'bg-amber-700/10'
                        }`}
                      >
                        <Trophy
                          className={`w-8 h-8 ${
                            winner.prize_rank === 1
                              ? 'text-yellow-500'
                              : winner.prize_rank === 2
                              ? 'text-gray-400'
                              : 'text-amber-700'
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">
                          {winner.prize_rank === 1 ? '🥇' : winner.prize_rank === 2 ? '🥈' : '🥉'}{' '}
                          {winner.prize_title}
                        </h3>
                        <p className="text-muted-foreground mb-2">
                          {winner.giveaway_entries.user_first_name}{' '}
                          {winner.giveaway_entries.user_last_name} -{' '}
                          {winner.giveaway_entries.user_email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Winning Entry: #{winner.winning_entry_number}
                        </p>
                        {winner.credit_code && (
                          <div className="mt-2">
                            <Badge variant="secondary">Credit Code: {winner.credit_code}</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant={winner.status === 'claimed' ? 'default' : 'secondary'}>
                      {capitalize(winner.status || 'pending')}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
