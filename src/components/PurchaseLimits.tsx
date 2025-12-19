import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle } from "lucide-react";

const DAILY_LIMITS = {
  FLOWER_GRAMS: 85.05, // 3 oz
  CONCENTRATE_GRAMS: 24,
};

const PurchaseLimits = () => {
  const { user } = useAuth();

  const { data: limits } = useQuery({
    queryKey: ["purchase-limits", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("purchase_limits")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today.toISOString().split("T")[0])
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      return data || { flower_grams: 0, concentrate_grams: 0 };
    },
    enabled: !!user,
  });

  if (!user || !limits) return null;

  const flowerGrams = parseFloat(String(limits.flower_grams || 0));
  const concentrateGrams = parseFloat(String(limits.concentrate_grams || 0));

  const flowerPercent = (flowerGrams / DAILY_LIMITS.FLOWER_GRAMS) * 100;
  const concentratePercent = (concentrateGrams / DAILY_LIMITS.CONCENTRATE_GRAMS) * 100;

  const isNearLimit = flowerPercent > 80 || concentratePercent > 80;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Daily Purchase Limits
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Flower</span>
            <span className="text-muted-foreground">
              {flowerGrams.toFixed(1)}g / {DAILY_LIMITS.FLOWER_GRAMS}g (3 oz)
            </span>
          </div>
          <Progress value={flowerPercent} className={flowerPercent > 80 ? "bg-red-200" : ""} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Concentrates</span>
            <span className="text-muted-foreground">
              {concentrateGrams.toFixed(1)}g / {DAILY_LIMITS.CONCENTRATE_GRAMS}g
            </span>
          </div>
          <Progress value={concentratePercent} className={concentratePercent > 80 ? "bg-red-200" : ""} />
        </div>

        {isNearLimit && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ You're approaching your daily purchase limit. Limits reset at midnight EST.
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Flower limit: 3 ounces (85.05g) per day</p>
          <p>• Concentrate limit: 24 grams per day</p>
          <p>• Limits reset daily at 12:00 AM EST</p>
          <p>• Per NYC cannabis regulations</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PurchaseLimits;
