import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, TrendingUp, Users } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  type: "email" | "sms";
  status: string;
}

interface CampaignAnalyticsProps {
  campaigns: Campaign[];
}

export function CampaignAnalytics({ campaigns }: CampaignAnalyticsProps) {
  const emailCampaigns = campaigns.filter((c) => c.type === "email");
  const smsCampaigns = campaigns.filter((c) => c.type === "sms");
  const activeCampaigns = campaigns.filter((c) => c.status === "sent" || c.status === "sending");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

