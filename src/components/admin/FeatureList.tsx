/**
 * Feature List Component
 * Displays and manages feature toggles for a tenant
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface FeatureListProps {
  features: Record<string, boolean>;
  readOnly?: boolean;
  tenantId?: string;
}

export function FeatureList({ features, readOnly = false, tenantId }: FeatureListProps) {
  const queryClient = useQueryClient();
  const [localFeatures, setLocalFeatures] = useState<Record<string, boolean>>(features || {});

  const updateFeaturesMutation = useMutation({
    mutationFn: async (newFeatures: Record<string, boolean>) => {
      if (!tenantId) throw new Error("Tenant ID is required");

      const { error } = await supabase
        .from("tenants")
        .update({ features: newFeatures })
        .eq("id", tenantId);

      if (error) throw error;
      return newFeatures;
    },
    onSuccess: (newFeatures) => {
      setLocalFeatures(newFeatures);
      queryClient.invalidateQueries({ queryKey: ["super-admin-tenant", tenantId] });
      toast({
        title: "Features updated",
        description: "Tenant features have been updated successfully",
      });
    },
    onError: (error: unknown) => {
      toast({
        variant: "destructive",
        title: "Failed to update features",
        description: error.message || "An error occurred",
      });
    },
  });

  const handleToggle = (key: string, enabled: boolean) => {
    if (readOnly) return;

    const updated = {
      ...localFeatures,
      [key]: enabled,
    };
    setLocalFeatures(updated);

    if (tenantId) {
      updateFeaturesMutation.mutate(updated);
    }
  };

  const featureDefinitions = [
    { key: "api_access", label: "API Access", description: "Enable RESTful API access" },
    { key: "custom_branding", label: "Custom Branding", description: "Customize colors, logo, and theme" },
    { key: "white_label", label: "White Label", description: "Remove branding and use custom domain" },
    { key: "advanced_analytics", label: "Advanced Analytics", description: "Enhanced reporting and insights" },
    { key: "sms_enabled", label: "SMS Enabled", description: "Send SMS notifications" },
    { key: "disposable_menus", label: "Disposable Menus", description: "OPSEC menu system" },
    { key: "inventory_tracking", label: "Inventory Tracking", description: "Advanced inventory management" },
    { key: "fleet_management", label: "Fleet Management", description: "Runner and delivery tracking" },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {featureDefinitions.map((feature) => {
            const isEnabled = localFeatures[feature.key] || false;
            const isUpdating = updateFeaturesMutation.isPending;

            return (
              <div key={feature.key} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{feature.label}</h4>
                    <Badge variant={isEnabled ? "default" : "secondary"}>
                      {isEnabled ? "ON" : "OFF"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(feature.key, checked)}
                    disabled={readOnly || isUpdating}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
