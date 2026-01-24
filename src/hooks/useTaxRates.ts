import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type TaxType = "sales" | "excise" | "local" | "state" | "cannabis_excise";

export interface TaxRate {
  id: string;
  tenant_id: string;
  tax_type: TaxType;
  name: string;
  rate: number;
  applies_to: string[];
  effective_date: string;
  end_date: string | null;
  is_active: boolean;
}

export function useTaxRates(tenantId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: taxRates = [], isLoading } = useQuery({
    queryKey: ["tax-rates", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tax_rates")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("tax_type");
      if (error) throw error;
      return data as TaxRate[];
    },
    enabled: !!tenantId,
  });

  const calculateTaxes = async (subtotal: number, category = "all", isTaxExempt = false) => {
    if (!tenantId || isTaxExempt) return { taxes: [], totalTax: 0 };
    const { data, error } = await supabase.rpc("calculate_order_taxes", {
      p_tenant_id: tenantId,
      p_subtotal: subtotal,
      p_category: category,
      p_tax_exempt: isTaxExempt,
    });
    if (error) throw error;
    const taxes = (data || []) as Array<{ tax_type: string; tax_name: string; tax_rate: number; tax_amount: number }>;
    return { taxes, totalTax: taxes.reduce((sum, t) => sum + t.tax_amount, 0) };
  };

  const addTaxRate = useMutation({
    mutationFn: async (taxRate: Omit<TaxRate, "id">) => {
      if (!tenantId) throw new Error("No tenant");
      const { error } = await supabase.from("tax_rates").insert({
        ...taxRate,
        tenant_id: tenantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-rates"] });
      toast({ title: "Tax rate added" });
    },
  });

  return { taxRates, isLoading, calculateTaxes, addTaxRate };
}
