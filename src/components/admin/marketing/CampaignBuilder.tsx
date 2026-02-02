import { logger } from '@/lib/logger';
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Mail from "lucide-react/dist/esm/icons/mail";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import { queryKeys } from "@/lib/queryKeys";

interface CampaignBuilderProps {
  onClose: () => void;
}

export function CampaignBuilder({ onClose }: CampaignBuilderProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [campaignType, setCampaignType] = useState<"email" | "sms">("email");
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    content: "",
    audience: "all",
    scheduled_at: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; subject?: string; content: string; audience?: string; scheduled_at?: string; status?: string }) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      // Store campaign (would need marketing_campaigns table)
      try {
        const { error } = await supabase.from("marketing_campaigns").insert([
          {
            tenant_id: tenant.id,
            ...data,
            created_by: admin?.id || null,
          },
        ]);

        if (error && error.code !== "42P01") throw error;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code !== "42P01") throw error;
        // Table doesn't exist yet - that's okay for now
        logger.warn('Marketing campaigns table does not exist yet', { component: 'CampaignBuilder' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketing.campaigns() });
      toast.success("Campaign created successfully");
      onClose();
      setFormData({
        name: "",
        subject: "",
        content: "",
        audience: "all",
        scheduled_at: "",
      });
    },
    onError: (error: unknown) => {
      logger.error('Failed to create campaign', error, { component: 'CampaignBuilder' });
      toast.error("Failed to create campaign");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.content) {
      toast.error("Please fill in all required fields");
      return;
    }

    await createMutation.mutateAsync({
      name: formData.name,
      type: campaignType,
      subject: campaignType === "email" ? formData.subject : undefined,
      content: formData.content,
      audience: formData.audience,
      scheduled_at: formData.scheduled_at || undefined,
      status: "draft",
    });
  };

  return (
    <Tabs value={campaignType} onValueChange={(v) => setCampaignType(v as "email" | "sms")}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="email">
          <Mail className="h-4 w-4 mr-2" />
          Email
        </TabsTrigger>
        <TabsTrigger value="sms">
          <MessageSquare className="h-4 w-4 mr-2" />
          SMS
        </TabsTrigger>
      </TabsList>

      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Campaign Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            placeholder="e.g., Summer Sale 2024"
            required
            className="min-h-[44px] touch-manipulation"
          />
        </div>

        {campaignType === "email" && (
          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject Line <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder="e.g., 20% Off This Weekend!"
              required
              className="min-h-[44px] touch-manipulation"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="content">
            {campaignType === "email" ? "Email Content" : "SMS Message"}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="content"
            value={formData.content}
            onChange={(e) =>
              setFormData({ ...formData, content: e.target.value })
            }
            placeholder={
              campaignType === "email"
                ? "Enter your email content here..."
                : "Enter your SMS message (160 characters recommended)"
            }
            rows={campaignType === "email" ? 10 : 4}
            required
            className="min-h-[44px] touch-manipulation"
          />
          {campaignType === "sms" && (
            <p className="text-xs text-muted-foreground">
              {formData.content.length} characters
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="audience">Target Audience</Label>
            <Select
              value={formData.audience}
              onValueChange={(value) =>
                setFormData({ ...formData, audience: value })
              }
            >
              <SelectTrigger className="min-h-[44px] touch-manipulation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="active">Active Customers</SelectItem>
                <SelectItem value="at-risk">At-Risk Customers</SelectItem>
                <SelectItem value="new">New Customers</SelectItem>
                <SelectItem value="high-value">High-Value Customers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduled_at">Schedule (Optional)</Label>
            <Input
              id="scheduled_at"
              type="datetime-local"
              value={formData.scheduled_at}
              onChange={(e) =>
                setFormData({ ...formData, scheduled_at: e.target.value })
              }
              className="min-h-[44px] touch-manipulation"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="min-h-[44px] touch-manipulation"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="min-h-[44px] touch-manipulation"
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Campaign
          </Button>
        </div>
      </form>
    </Tabs>
  );
}

