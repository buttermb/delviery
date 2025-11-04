import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminNavigation } from "@/components/super-admin/SuperAdminNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Send, Users, TrendingUp, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Mock campaign data
const mockCampaigns = [
  { id: 1, name: 'Monthly Newsletter', sent: 1250, opened: 892, clicked: 234, created: '2024-01-10' },
  { id: 2, name: 'Product Update', sent: 980, opened: 765, clicked: 198, created: '2024-01-12' },
  { id: 3, name: 'Trial Reminder', sent: 450, opened: 312, clicked: 87, created: '2024-01-14' },
];

export default function CommunicationPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="min-h-screen bg-[hsl(var(--super-admin-bg))]">
      <header className="border-b border-white/10 bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">📧 Communications</h1>
            <p className="text-sm text-[hsl(var(--super-admin-text))]/70">Manage email campaigns & messaging</p>
          </div>
          <SuperAdminNavigation />
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Campaigns</CardTitle>
              <Mail className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">24</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">This month</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Total Sent</CardTitle>
              <Send className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">2,680</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Emails delivered</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Open Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">72.8%</div>
              <p className="text-xs text-green-400 mt-1">+5.2% ↑</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Click Rate</CardTitle>
              <Users className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">19.4%</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Above average</p>
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
                  {mockCampaigns.map((campaign) => (
                    <TableRow key={campaign.id} className="border-white/10">
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{campaign.name}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{campaign.sent.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-[hsl(var(--super-admin-text))]">{campaign.opened}</span>
                          <Badge className="bg-[hsl(var(--super-admin-primary))]/20 text-[hsl(var(--super-admin-primary))]">
                            {((campaign.opened / campaign.sent) * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-[hsl(var(--super-admin-text))]">{campaign.clicked}</span>
                          <Badge className="bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]">
                            {((campaign.clicked / campaign.sent) * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]/70">{campaign.created}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
