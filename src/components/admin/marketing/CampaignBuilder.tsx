import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { MarketingCampaign } from "@/components/admin/marketing/types";
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, MessageSquare } from "lucide-react";

const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  subject: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  audience: z.string().default("all"),
  scheduled_at: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface CampaignBuilderProps {
  campaign?: MarketingCampaign | null;
  onClose: () => void;
}

export function CampaignBuilder({ campaign, onClose }: CampaignBuilderProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [campaignType, setCampaignType] = useState<"email" | "sms">(
    campaign?.type === "sms" ? "sms" : "email"
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: campaign?.name ?? "",
      subject: campaign?.subject ?? "",
      content: campaign?.content ?? "",
      audience: campaign?.audience ?? "all",
      scheduled_at: campaign?.scheduled_at ?? "",
    },
  });

  const contentValue = watch("content");

  useEffect(() => {
    if (campaign) {
      reset({
        name: campaign.name,
        subject: campaign.subject ?? "",
        content: campaign.content,
        audience: campaign.audience ?? "all",
        scheduled_at: campaign.scheduled_at ?? "",
      });
      setCampaignType(campaign.type === "sms" ? "sms" : "email");
    }
  }, [campaign, reset]);

  const saveMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      if (!tenant?.id) throw new Error("Tenant ID required");

      const payload = {
        tenant_id: tenant.id,
        name: data.name,
        type: campaignType,
        subject: campaignType === "email" ? (data.subject || null) : null,
        content: data.content,
        audience: data.audience || "all",
        scheduled_at: data.scheduled_at || null,
        status: "draft",
        created_by: admin?.id ?? null,
      };

      if (campaign) {
        const { error } = await supabase
          .from("marketing_campaigns")
          .update(payload)
          .eq("id", campaign.id)
          .eq("tenant_id", tenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("marketing_campaigns")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketing.campaigns() });
      toast.success(campaign ? "Campaign updated" : "Campaign created");
      onClose();
      reset();
    },
    onError: (error: unknown) => {
      logger.error('Failed to save campaign', error, { component: 'CampaignBuilder' });
      toast.error("Failed to save campaign", { description: humanizeError(error) });
    },
  });

  const onSubmit = (data: CampaignFormData) => {
    saveMutation.mutate(data);
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Campaign Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            {...register("name")}
            placeholder="e.g., Summer Sale 2024"
            className="min-h-[44px] touch-manipulation"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {campaignType === "email" && (
          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject Line <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              {...register("subject")}
              placeholder="e.g., 20% Off This Weekend!"
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
            {...register("content")}
            placeholder={
              campaignType === "email"
                ? "Enter your email content here..."
                : "Enter your SMS message (160 characters recommended)"
            }
            rows={campaignType === "email" ? 10 : 4}
            className="min-h-[44px] touch-manipulation"
          />
          {errors.content && (
            <p className="text-xs text-destructive">{errors.content.message}</p>
          )}
          {campaignType === "sms" && (
            <p className="text-xs text-muted-foreground">
              {contentValue?.length ?? 0} characters
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="audience">Target Audience</Label>
            <Select
              value={watch("audience")}
              onValueChange={(value) => setValue("audience", value)}
            >
              <SelectTrigger className="min-h-[44px] touch-manipulation">
                <SelectValue placeholder="Select audience" />
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
              {...register("scheduled_at")}
              className="min-h-[44px] touch-manipulation"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saveMutation.isPending}
            className="min-h-[44px] touch-manipulation"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saveMutation.isPending}
            className="min-h-[44px] touch-manipulation"
          >
            {saveMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {campaign ? "Update Campaign" : "Create Campaign"}
          </Button>
        </div>
      </form>
    </Tabs>
  );
}
