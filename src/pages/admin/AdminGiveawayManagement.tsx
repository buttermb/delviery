import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { capitalize } from '@/utils/stringHelpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, ShieldAlert, CheckCircle, XCircle, Mail, Phone, 
  Instagram, TrendingUp, AlertTriangle, Download 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedMetricCard } from '@/components/admin/AnimatedMetricCard';

export default function AdminGiveawayManagement() {
  const [stats, setStats] = useState({
    totalEntries: 0,
    verified: 0,
    pending: 0,
    fraudBlocked: 0,
    verificationRate: 0
  });
  const [entries, setEntries] = useState<any[]>([]);
  const [failedAttempts, setFailedAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load all entries
      const { data: entriesData } = await supabase
        .from('giveaway_entries')
        .select('*')
        .order('entered_at', { ascending: false });

      setEntries(entriesData || []);

      // Load failed attempts
      const { data: failedData } = await supabase
        .from('giveaway_failed_attempts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      setFailedAttempts(failedData || []);

      // Calculate stats
      const total = entriesData?.length || 0;
      const verified = entriesData?.filter(e => e.status === 'verified').length || 0;
      const pending = entriesData?.filter(e => e.status === 'pending').length || 0;
      const fraudBlocked = entriesData?.filter(e => e.fraud_score > 70).length || 0;

      setStats({
        totalEntries: total,
        verified,
        pending,
        fraudBlocked,
        verificationRate: total > 0 ? Math.round((verified / total) * 100) : 0
      });

    } catch (error) {
      console.error('Error loading giveaway data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function exportEntries() {
    const verifiedEntries = entries.filter(e => e.status === 'verified');
    
    const csv = [
      ['Entry Number', 'Email', 'Phone', 'Name', 'Borough', 'Instagram', 'Total Entries', 'Verified At', 'Fraud Score'],
      ...verifiedEntries.map((e) => [
        `${e.entry_number_start}-${e.entry_number_end}`,
        e.user_email,
        e.user_phone,
        `${e.user_first_name} ${e.user_last_name}`,
        e.user_borough,
        e.instagram_handle,
        e.total_entries,
        new Date(e.verified_at).toLocaleString(),
        e.fraud_score
      ])
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `giveaway-entries-verified-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Giveaway Management</h1>
          <p className="text-muted-foreground">Monitor entries, verification, and fraud prevention</p>
        </div>
        <Button onClick={exportEntries} className="gap-2">
          <Download className="w-4 h-4" />
          Export Verified Entries
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <AnimatedMetricCard
          title="Total Entries"
          value={stats.totalEntries}
          icon={Users}
        />
        <AnimatedMetricCard
          title="Verified"
          value={stats.verified}
          icon={CheckCircle}
          trend={`${stats.verificationRate}% rate`}
          trendUp={stats.verificationRate > 50}
        />
        <AnimatedMetricCard
          title="Pending"
          value={stats.pending}
          icon={AlertTriangle}
        />
        <AnimatedMetricCard
          title="Fraud Blocked"
          value={stats.fraudBlocked}
          icon={ShieldAlert}
        />
        <AnimatedMetricCard
          title="Avg Entries/User"
          value={stats.verified > 0 ? 
            Math.round(entries.reduce((sum, e) => sum + e.total_entries, 0) / stats.verified * 10) / 10 
            : 0}
          icon={TrendingUp}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="entries" className="w-full">
        <TabsList>
          <TabsTrigger value="entries">All Entries ({entries.length})</TabsTrigger>
          <TabsTrigger value="verified">Verified ({stats.verified})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="fraud">Fraud Alerts ({stats.fraudBlocked})</TabsTrigger>
          <TabsTrigger value="failed">Failed Attempts ({failedAttempts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <EntriesTable entries={entries} />
        </TabsContent>

        <TabsContent value="verified">
          <EntriesTable entries={entries.filter(e => e.status === 'verified')} />
        </TabsContent>

        <TabsContent value="pending">
          <EntriesTable entries={entries.filter(e => e.status === 'pending')} />
        </TabsContent>

        <TabsContent value="fraud">
          <EntriesTable entries={entries.filter(e => e.fraud_score > 70)} />
        </TabsContent>

        <TabsContent value="failed">
          <FailedAttemptsTable attempts={failedAttempts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EntriesTable({ entries }: { entries: any[] }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Entry #</th>
                <th className="text-left py-3 px-4">Name</th>
                <th className="text-left py-3 px-4">Contact</th>
                <th className="text-left py-3 px-4">Verification</th>
                <th className="text-left py-3 px-4">Entries</th>
                <th className="text-left py-3 px-4">Fraud Score</th>
                <th className="text-left py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <motion.tr 
                  key={entry.id} 
                  className="border-b hover:bg-muted/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <td className="py-3 px-4 font-mono text-sm">
                    {entry.entry_number_start}-{entry.entry_number_end}
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium">
                        {entry.user_first_name} {entry.user_last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.user_borough}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs">
                        <Mail className="w-3 h-3" />
                        {entry.user_email}
                        {entry.email_verified && <CheckCircle className="w-3 h-3 text-green-500" />}
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <Phone className="w-3 h-3" />
                        {entry.user_phone}
                        {entry.phone_verified && <CheckCircle className="w-3 h-3 text-green-500" />}
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <Instagram className="w-3 h-3" />
                        @{entry.instagram_handle}
                        {entry.instagram_verified && <CheckCircle className="w-3 h-3 text-green-500" />}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={entry.status === 'verified' ? 'default' : 'secondary'}>
                      {capitalize(entry.status || 'pending')}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline">{entry.total_entries}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={entry.fraud_score > 70 ? 'destructive' : entry.fraud_score > 30 ? 'secondary' : 'outline'}
                    >
                      {entry.fraud_score}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {new Date(entry.entered_at).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function FailedAttemptsTable({ attempts }: { attempts: any[] }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Phone</th>
                <th className="text-left py-3 px-4">Instagram</th>
                <th className="text-left py-3 px-4">Error Type</th>
                <th className="text-left py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 text-sm">
                    {new Date(attempt.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-sm">{attempt.email}</td>
                  <td className="py-3 px-4 text-sm">{attempt.phone}</td>
                  <td className="py-3 px-4 text-sm">@{attempt.instagram_handle}</td>
                  <td className="py-3 px-4">
                    <Badge variant="destructive">{attempt.error_type}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm font-mono">
                    {attempt.ip_address}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}