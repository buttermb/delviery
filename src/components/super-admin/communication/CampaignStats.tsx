/**
 * Campaign Statistics Component
 * Track email campaign performance
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Mail, Eye, MousePointerClick } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function CampaignStats() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaign-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data || []).map((campaign: any) => {
        const stats = campaign.stats || {};
        return {
          id: campaign.id,
          subject: campaign.subject,
          sentAt: campaign.sent_at,
          recipients: campaign.recipients?.length || 0,
          opens: stats.opens || 0,
          clicks: stats.clicks || 0,
          openRate: campaign.recipients?.length > 0
            ? ((stats.opens || 0) / campaign.recipients.length) * 100
            : 0,
          clickRate: campaign.recipients?.length > 0
            ? ((stats.clicks || 0) / campaign.recipients.length) * 100
            : 0,
        };
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Campaign Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No campaigns sent yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Campaign Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">{campaign.subject}</p>
                <Badge variant="outline">
                  {new Date(campaign.sentAt).toLocaleDateString()}
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Recipients</p>
                  <p className="font-semibold">{campaign.recipients}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Opens</p>
                  <p className="font-semibold">{campaign.opens}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.openRate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Clicks</p>
                  <p className="font-semibold">{campaign.clicks}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.clickRate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">CTR</p>
                  <p className="font-semibold">{campaign.clickRate.toFixed(2)}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

