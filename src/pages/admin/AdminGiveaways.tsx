import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Eye, Edit, TrendingUp, Users, Award, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { safeStatus, safeUpperCase } from '@/utils/stringHelpers';

interface Giveaway {
  id: string;
  title: string;
  tagline: string;
  slug: string;
  status: string;
  start_date: string;
  end_date: string;
  total_entries: number;
  total_participants: number;
  grand_prize_value: number;
}

export default function AdminGiveaways() {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGiveaways();
  }, []);

  const loadGiveaways = async () => {
    try {
      const { data, error } = await supabase
        .from('giveaways')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGiveaways(data || []);
    } catch (error) {
      console.error('Error loading giveaways:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-500/10 text-green-400 border-green-500/20',
      ended: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      draft: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      winners_selected: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    };
    
    const safeStatusValue = safeStatus(status);
    return (
      <Badge className={`${variants[safeStatusValue as keyof typeof variants] || variants.draft} border`}>
        {safeUpperCase(safeStatusValue)}
      </Badge>
    );
  };

  const getDaysRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Ended';
    if (days === 0) return 'Ends today';
    if (days === 1) return 'Ends tomorrow';
    return `Ends in ${days} days`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Award className="w-12 h-12 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading giveaways...</p>
        </div>
      </div>
    );
  }

  const activeGiveaways = giveaways.filter(g => g.status === 'active');
  const pastGiveaways = giveaways.filter(g => g.status !== 'active');

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">Giveaways</h1>
          <p className="text-muted-foreground">Manage and track your giveaway campaigns</p>
        </div>
        <div className="flex gap-2">
          {activeGiveaways.length > 0 && (
            <>
              <Link to="/admin/giveaway">
                <Button variant="outline" className="gap-2">
                  <Eye className="w-4 h-4" />
                  View Active Detail
                </Button>
              </Link>
              <Link to="/admin/giveaways/manage">
                <Button variant="outline" className="gap-2">
                  <Users className="w-4 h-4" />
                  Manage Entries
                </Button>
              </Link>
            </>
          )}
          <Link to="/admin/giveaways/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Giveaway
            </Button>
          </Link>
        </div>
      </div>

      {/* Active Giveaways */}
      {activeGiveaways.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Active Giveaways</h2>
          <div className="grid gap-6">
            {activeGiveaways.map((giveaway, index) => (
              <motion.div
                key={giveaway.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-bold">{giveaway.title}</h3>
            {getStatusBadge(giveaway.status)}
          </div>
          <p className="text-muted-foreground">{giveaway.tagline}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-blue-400">Participants</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-400">
                      {giveaway.total_participants.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400">Total Entries</span>
                    </div>
                    <div className="text-2xl font-bold text-green-400">
                      {giveaway.total_entries.toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-purple-400">Avg per User</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-400">
                      {giveaway.total_participants > 0 
                        ? (giveaway.total_entries / giveaway.total_participants).toFixed(1)
                        : '0'}
                    </div>
                  </div>
                  
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-orange-400">Prize Value</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-400">
                      ${giveaway.grand_prize_value.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    {getDaysRemaining(giveaway.end_date)}
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/giveaway/${giveaway.slug}`} target="_blank">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Eye className="w-4 h-4" />
                        View Live
                      </Button>
                    </Link>
                    <Link to={`/admin/giveaways/${giveaway.id}/analytics`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Analytics
                      </Button>
                    </Link>
                    <Link to={`/admin/giveaways/${giveaway.id}/edit`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                    </Link>
                    <Link to={`/admin/giveaways/${giveaway.id}/winners`}>
                      <Button size="sm" className="gap-2">
                        <Trophy className="w-4 h-4" />
                        Winners
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Past Giveaways */}
      {pastGiveaways.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Past Giveaways</h2>
          <div className="grid gap-4">
            {pastGiveaways.map((giveaway, index) => (
              <motion.div
                key={giveaway.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-lg p-4 opacity-75 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold">{giveaway.title}</h3>
                      {getStatusBadge(giveaway.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {giveaway.total_participants.toLocaleString()} participants • 
                      {giveaway.total_entries.toLocaleString()} entries
                    </p>
                  </div>
                    <Link to={`/admin/giveaways/${giveaway.id}/winners`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Trophy className="w-4 h-4" />
                        View Results
                      </Button>
                    </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {giveaways.length === 0 && (
        <div className="text-center py-16">
          <Award className="w-20 h-20 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">No Giveaways Yet</h2>
          <p className="text-muted-foreground mb-8">
            Create your first giveaway to start engaging with customers
          </p>
          <Link to="/admin/giveaways/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Giveaway
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
