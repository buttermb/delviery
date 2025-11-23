import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Mail,
  MessageSquare,
  Zap,
  TrendingUp,
  Plus,
  Loader2,
} from "lucide-react";
import { CampaignBuilder } from "@/components/admin/marketing/CampaignBuilder";
import { WorkflowEditor } from "@/components/admin/marketing/WorkflowEditor";
import { CampaignAnalytics } from "@/components/admin/marketing/CampaignAnalytics";
import { queryKeys } from "@/lib/queryKeys";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface MarketingCampaign {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'failed';
  subject?: string;
  content?: string;
  audience_config?: Record<string, unknown>;
  scheduled_at?: string;
  sent_at?: string;
  created_at: string;
}

export default function MarketingAutomationPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);

  // For now, campaigns would be stored in a campaigns table (may need to be created)
  const { data: campaigns, isLoading } = useQuery({
    queryKey: queryKeys.marketing.campaigns(),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        const { data, error } = await supabase
          .from('marketing_campaigns')
          .select('*')
          .eq('tenant_id', tenant?.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data as MarketingCampaign[]) || [];
      } catch (error) {
        logger.error('Failed to fetch campaigns', error, { component: 'MarketingAutomationPage' });
        return [];
      }
    },
    enabled: !!tenant?.id,
  });

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            📧 Marketing Automation
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Create campaigns, automate workflows, and track engagement
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsCreateOpen(true)}
            className="min-h-[44px] touch-manipulation"
          >
            <Zap className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">New Workflow</span>
          </Button>
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="text-sm sm:text-base">New Campaign</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="campaigns" className="min-h-[44px] touch-manipulation">
            <Mail className="h-4 w-4 mr-2" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="workflows" className="min-h-[44px] touch-manipulation">
            <Zap className="h-4 w-4 mr-2" />
            Workflows
          </TabsTrigger>
          <TabsTrigger value="analytics" className="min-h-[44px] touch-manipulation">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email & SMS Campaigns</CardTitle>
              <CardDescription>
                Create and manage marketing campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : campaigns && campaigns.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{campaigns.length} campaigns found</p>
                  <p className="text-sm mt-2">Manage your marketing campaigns with email, SMS, and push notifications</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No campaigns found. Create your first campaign to get started.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <WorkflowEditor />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <CampaignAnalytics campaigns={campaigns || []} />
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New {activeTab === 'campaigns' ? 'Campaign' : 'Workflow'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {activeTab === 'campaigns' ? (
              <CampaignBuilder onClose={() => setIsCreateOpen(false)} />
            ) : (
              <WorkflowEditor />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
