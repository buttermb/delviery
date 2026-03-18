import type { MarketingCampaign } from "@/components/admin/marketing/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, TrendingUp, Users, MousePointerClick, Eye } from "lucide-react";

interface CampaignAnalyticsProps {
  campaigns: MarketingCampaign[];
}

export function CampaignAnalytics({ campaigns }: CampaignAnalyticsProps) {
  const activeCampaigns = campaigns.filter((c) => c.status === "sent" || c.status === "sending");

  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count ?? 0), 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + (c.opened_count ?? 0), 0);
  const totalClicked = campaigns.reduce((sum, c) => sum + (c.clicked_count ?? 0), 0);

  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
  const clickRate = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            {campaigns.length}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {activeCampaigns.length} active
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" />
            {totalSent.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            messages delivered
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            {openRate}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalOpened.toLocaleString()} opened
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <MousePointerClick className="h-5 w-5 text-muted-foreground" />
            {clickRate}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalClicked.toLocaleString()} clicked
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Active Now</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            {activeCampaigns.length}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            sending or scheduled
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
