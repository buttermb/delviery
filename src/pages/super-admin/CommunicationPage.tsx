import { useState, useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Send, Users, TrendingUp, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatSmartDate } from '@/lib/utils/formatDate';
import { queryKeys } from '@/lib/queryKeys';

export default function CommunicationPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Fetch campaigns from all tenants
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.campaigns(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('id, name, sent_count, opened_count, clicked_count, created_at, status, tenant_id')
        .in('status', ['sent', 'sending'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Calculate stats
  const stats = useMemo(() => {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    
    const thisMonthCampaigns = campaigns.filter(c => 
      new Date(c.created_at || 0) >= thisMonth
    );

    const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0);
    const totalOpened = campaigns.reduce((sum, c) => sum + (c.opened_count || 0), 0);
    const totalClicked = campaigns.reduce((sum, c) => sum + (c.clicked_count || 0), 0);
    
    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0';
    const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0.0';

    return {
      campaigns: thisMonthCampaigns.length,
      totalSent,
      openRate: parseFloat(openRate),
      clickRate: parseFloat(clickRate),
    };
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📧 Communications</h1>
        <p className="text-sm text-muted-foreground">Manage email campaigns & messaging</p>
      </div>
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Campaigns</CardTitle>
              <Mail className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {isLoading ? '...' : stats.campaigns}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">This month</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Total Sent</CardTitle>
              <Send className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {isLoading ? '...' : stats.totalSent.toLocaleString()}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Emails delivered</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Open Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {isLoading ? '...' : `${stats.openRate}%`}
              </div>
              <p className="text-xs text-green-400 mt-1">Average open rate</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Click Rate</CardTitle>
              <Users className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {isLoading ? '...' : `${stats.clickRate}%`}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Average click rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Email Composer */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))] flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Create New Campaign
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-[hsl(var(--super-admin-text))]/90">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
                className="bg-black/20 border-white/10 text-[hsl(var(--super-admin-text))]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-[hsl(var(--super-admin-text))]/90">Message</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Compose your message..."
                className="bg-black/20 border-white/10 text-[hsl(var(--super-admin-text))] min-h-[150px]"
              />
            </div>
            <div className="flex gap-2">
              <Button className="bg-[hsl(var(--super-admin-primary))] hover:bg-[hsl(var(--super-admin-primary))]/90">
                <Send className="h-4 w-4 mr-2" />
                Send Campaign
              </Button>
              <Button variant="outline" className="border-white/10 text-[hsl(var(--super-admin-text))]">
                Save Draft
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Campaigns */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))] flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Campaign</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Sent</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Opened</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Clicked</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Loading campaigns...
                      </TableCell>
                    </TableRow>
                  ) : campaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No campaigns found
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaigns.map((campaign) => {
                      const sent = campaign.sent_count || 0;
                      const opened = campaign.opened_count || 0;
                      const clicked = campaign.clicked_count || 0;
                      const openRate = sent > 0 ? ((opened / sent) * 100).toFixed(1) : '0.0';
                      const clickRate = sent > 0 ? ((clicked / sent) * 100).toFixed(1) : '0.0';

                      return (
                        <TableRow key={campaign.id} className="border-white/10">
                          <TableCell className="text-[hsl(var(--super-admin-text))]">{campaign.name || 'Unnamed Campaign'}</TableCell>
                          <TableCell className="text-[hsl(var(--super-admin-text))]">{sent.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-[hsl(var(--super-admin-text))]">{opened}</span>
                              <Badge className="bg-[hsl(var(--super-admin-primary))]/20 text-[hsl(var(--super-admin-primary))]">
                                {openRate}%
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-[hsl(var(--super-admin-text))]">{clicked}</span>
                              <Badge className="bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]">
                                {clickRate}%
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-[hsl(var(--super-admin-text))]/70">
                            {campaign.created_at ? formatSmartDate(campaign.created_at) : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
