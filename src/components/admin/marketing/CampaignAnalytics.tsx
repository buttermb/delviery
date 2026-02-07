import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, TrendingUp, Users, Bell } from "lucide-react";

interface MarketingCampaign {
  id: string;
  name: string;
  type: "email" | "sms" | "push";
  status: string;
}

interface CampaignAnalyticsProps {
  campaigns: MarketingCampaign[];
}

export function CampaignAnalytics({ campaigns }: CampaignAnalyticsProps) {
  const emailCampaigns = campaigns.filter((c) => c.type === "email");
  const smsCampaigns = campaigns.filter((c) => c.type === "sms");
  const pushCampaigns = campaigns.filter((c) => c.type === "push");
  const activeCampaigns = campaigns.filter((c) => c.status === "sent" || c.status === "sending");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {campaigns.length}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Email Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {emailCampaigns.length}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">SMS Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {smsCampaigns.length}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Push Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {pushCampaigns.length}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" />
            {activeCampaigns.length}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

