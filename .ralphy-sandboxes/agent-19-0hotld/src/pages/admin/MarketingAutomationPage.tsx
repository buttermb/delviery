import { useState } from "react";
import { logger } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail,
  Zap,
  TrendingUp,
  Plus,
  Calendar,
  MoreHorizontal
} from "lucide-react";
import { CampaignBuilder } from "@/components/admin/marketing/CampaignBuilder";
import { WorkflowEditor } from "@/components/admin/marketing/WorkflowEditor";
import { CampaignAnalytics } from "@/components/admin/marketing/CampaignAnalytics";
import { queryKeys } from "@/lib/queryKeys";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [_editingCampaign, _setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: queryKeys.marketing.campaigns(),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        const { data, error } = await supabase
          .from('marketing_campaigns')
          .select('id, name, type, status, subject, content, audience_config, scheduled_at, sent_at, created_at')
          .eq('tenant_id', tenant?.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data as MarketingCampaign[]) ?? [];
      } catch (error) {
        logger.error('Failed to fetch campaigns', error, { component: 'MarketingAutomationPage' });
        return [];
      }
    },
    enabled: !!tenant?.id,
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant?.id) throw new Error('No tenant');
      const { error } = await supabase
        .from('marketing_campaigns')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Campaign deleted successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.marketing.campaigns() });
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to delete campaign'));
    },
  });

  const handleEditCampaign = (campaign: MarketingCampaign) => {
    _setEditingCampaign(campaign);
    setIsCreateOpen(true);
  };

  const handleDuplicateCampaign = async (campaign: MarketingCampaign) => {
    try {
      const { error } = await supabase
        .from('marketing_campaigns')
        .insert({
          tenant_id: tenant?.id,
          name: `${campaign.name} (Copy)`,
          type: campaign.type,
          status: 'draft',
          subject: campaign.subject,
          content: campaign.content,
          audience_config: campaign.audience_config,
        });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: queryKeys.marketing.campaigns() });
    } catch (error) {
      logger.error('Failed to duplicate campaign', error, { component: 'MarketingAutomationPage' });
      toast.error('Failed to duplicate campaign', { description: humanizeError(error) });
    }
  };

  const handleDeleteCampaign = (id: string) => {
    setCampaignToDelete(id);
    setDeleteDialogOpen(true);
  };

  const filteredCampaigns = campaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground border-muted';
      case 'scheduled': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'sending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'sent': return 'bg-green-500/10 text-green-600 border-green-200';
      case 'paused': return 'bg-orange-500/10 text-orange-600 border-orange-200';
      case 'failed': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const columns: ResponsiveColumn<MarketingCampaign>[] = [
    {
      header: 'Name',
      accessorKey: 'name',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.subject && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{row.subject}</div>}
        </div>
      )
    },
    {
      header: 'Type',
      accessorKey: 'type',
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.type}
        </Badge>
      )
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => (
        <Badge variant="outline" className={getStatusColor(row.status)}>
          {row.status}
        </Badge>
      )
    },
    {
      header: 'Schedule',
      cell: (row) => (
        <div className="flex flex-col text-xs">
          {row.scheduled_at ? (
            <span className="flex items-center gap-1 text-blue-600">
              <Calendar className="h-3 w-3" /> {format(new Date(row.scheduled_at), 'MMM d, h:mm a')}
            </span>
          ) : row.sent_at ? (
            <span className="text-muted-foreground">Sent: {format(new Date(row.sent_at), 'MMM d, h:mm a')}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      )
    },
    {
      header: 'Actions',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-11 w-11 p-0" aria-label="Campaign actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEditCampaign(row)}>Edit Campaign</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDuplicateCampaign(row)}>Duplicate</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCampaign(row.id)}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">
            Marketing Automation
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
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <CardTitle>Email & SMS Campaigns</CardTitle>
                  <CardDescription>Create and manage marketing campaigns</CardDescription>
                </div>
                <div className="w-full sm:w-72">
                  <SearchInput
                    placeholder="Search campaigns..."
                    onSearch={setSearchQuery}
                    defaultValue={searchQuery}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <ResponsiveTable
                columns={columns}
                data={filteredCampaigns}
                isLoading={isLoading}
                keyExtractor={(item) => item.id}
                emptyState={{
                  type: 'generic',
                  title: "No Campaigns Found",
                  description: "Get started by creating your first marketing campaign.",
                  icon: Mail,
                  primaryAction: {
                    label: "Create Campaign",
                    onClick: () => setIsCreateOpen(true),
                    icon: Plus
                  }
                }}
                mobileRenderer={(row) => (
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{row.name}</div>
                        <div className="text-sm text-muted-foreground">{row.subject}</div>
                      </div>
                      <Badge variant="outline" className={getStatusColor(row.status)}>
                        {row.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span className="capitalize">{row.type}</span>
                      <span>
                        {row.scheduled_at ? format(new Date(row.scheduled_at), 'MMM d') :
                          row.sent_at ? `Sent ${format(new Date(row.sent_at), 'MMM d')}` : 'Draft'}
                      </span>
                    </div>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <WorkflowEditor />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <CampaignAnalytics campaigns={campaigns ?? []} />
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (campaignToDelete) {
            deleteCampaignMutation.mutate(campaignToDelete);
            setDeleteDialogOpen(false);
            setCampaignToDelete(null);
          }
        }}
        itemType="campaign"
        isLoading={deleteCampaignMutation.isPending}
      />
    </div>
  );
}
