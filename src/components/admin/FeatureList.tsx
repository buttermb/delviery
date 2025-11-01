import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FeatureToggle } from "./FeatureToggle";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface FeatureListProps {
  tenantId: string;
  readOnly?: boolean;
}

export function FeatureList({ tenantId, readOnly = false }: FeatureListProps) {
  // Fetch tenant features
  const { data: features, isLoading, refetch } = useQuery({
    queryKey: ["tenant-features", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_features")
        .select("*")
        .eq("tenant_id", tenantId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch available features from plan
  const { data: plan } = useQuery({
    queryKey: ["tenant-plan", tenantId],
    queryFn: async () => {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("subscription_plan")
        .eq("id", tenantId)
        .maybeSingle();

      if (!tenant?.subscription_plan) return null;

      const { data: planData } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("name", tenant.subscription_plan)
        .maybeSingle();

      return planData;
    },
    enabled: !!tenantId,
  });

  const handleToggleFeature = async (featureName: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("tenant_features")
        .upsert({
          tenant_id: tenantId,
          feature_name: featureName,
          enabled,
          granted_by: null, // Should be current super admin ID
          granted_at: new Date().toISOString(),
        }, {
          onConflict: "tenant_id,feature_name",
        });

      if (error) throw error;

      toast({
        title: "Feature updated",
        description: `${featureName} has been ${enabled ? "enabled" : "disabled"}`,
      });

      refetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update feature",
        description: error.message,
      });
    }
  };

  const handleSetCustomLimit = async (featureName: string, limit: number) => {
    try {
      const { error } = await supabase
        .from("tenant_features")
        .update({
          custom_limit: limit,
        })
        .eq("tenant_id", tenantId)
        .eq("feature_name", featureName);

      if (error) throw error;

      toast({
        title: "Custom limit set",
        description: `Limit updated for ${featureName}`,
      });

      refetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to set limit",
        description: error.message,
      });
    }
  };

  const handleSetExpiration = async (featureName: string, expiresAt: string) => {
    try {
      const { error } = await supabase
        .from("tenant_features")
        .update({
          expires_at: expiresAt || null,
        })
        .eq("tenant_id", tenantId)
        .eq("feature_name", featureName);

      if (error) throw error;

      toast({
        title: "Expiration set",
        description: `Expiration updated for ${featureName}`,
      });

      refetch();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to set expiration",
        description: error.message,
      });
    }
  };

  // Define all available features
  const allFeatures = [
    "disposable_menus",
    "custom_branding",
    "api_access",
    "white_label",
    "sso_saml",
    "advanced_analytics",
    "priority_support",
    "sms_enabled",
  ];

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading features...</div>;
  }

  // Merge plan features with tenant-specific overrides
  const featureList = allFeatures.map((featureName) => {
    const tenantFeature = features?.find((f) => f.feature_name === featureName);
    const isIncludedInPlan = plan?.features?.includes(featureName);

    return {
      feature_name: featureName,
      enabled: tenantFeature?.enabled ?? isIncludedInPlan ?? false,
      custom_limit: tenantFeature?.custom_limit,
      expires_at: tenantFeature?.expires_at,
      reason: tenantFeature?.reason,
      granted_by: tenantFeature?.granted_by,
      isIncludedInPlan,
    };
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Feature Management</CardTitle>
          {!readOnly && (
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Grant Custom Feature
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {featureList.map((feature) => (
          <FeatureToggle
            key={feature.feature_name}
            feature={feature}
            onToggle={(enabled) => handleToggleFeature(feature.feature_name, enabled)}
            onSetCustomLimit={(limit) => handleSetCustomLimit(feature.feature_name, limit)}
            onSetExpiration={(expiresAt) => handleSetExpiration(feature.feature_name, expiresAt)}
            readOnly={readOnly}
          />
        ))}
      </CardContent>
    </Card>
  );
}

