import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";
import { humanizeError } from "@/lib/humanizeError";

export interface InvoiceTemplateData {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  layout: {
    logoPosition: "left" | "center" | "right";
    showFooter: boolean;
    compactMode: boolean;
  };
  content: {
    footerText: string;
    paymentInstructions: string;
  };
}

export interface InvoiceTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  template_data: InvoiceTemplateData;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TEMPLATES: Omit<InvoiceTemplate, "id" | "tenant_id" | "created_at" | "updated_at">[] = [
  {
    name: "Professional",
    description: "Clean and professional design",
    template_data: {
      colors: { primary: "#10b981", secondary: "#6b7280", accent: "#3b82f6" },
      layout: { logoPosition: "left", showFooter: true, compactMode: false },
      content: { footerText: "Thank you for your business!", paymentInstructions: "" }
    },
    is_default: true,
    is_system: true
  },
  {
    name: "Minimal",
    description: "Simple and minimalist",
    template_data: {
      colors: { primary: "#000000", secondary: "#71717a", accent: "#000000" },
      layout: { logoPosition: "center", showFooter: false, compactMode: true },
      content: { footerText: "", paymentInstructions: "" }
    },
    is_default: false,
    is_system: true
  },
  {
    name: "Colorful",
    description: "Vibrant and eye-catching",
    template_data: {
      colors: { primary: "#8b5cf6", secondary: "#ec4899", accent: "#f59e0b" },
      layout: { logoPosition: "left", showFooter: true, compactMode: false },
      content: { footerText: "We appreciate your business! 🎉", paymentInstructions: "" }
    },
    is_default: false,
    is_system: true
  }
];

export function useInvoiceTemplates() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: queryKeys.invoiceTemplates.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from("invoice_templates")
        .select('id, tenant_id, name, description, template_data, is_default, is_system, created_at, updated_at')
        .eq("tenant_id", tenant.id)
        .order("is_default", { ascending: false })
        .order("name");

      if (error) throw error;

      // If no templates exist, return default templates (will be created on first save)
      if (!data || data.length === 0) {
        return DEFAULT_TEMPLATES.map((t, i) => ({
          ...t,
          id: `default-${i}`,
          tenant_id: tenant.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })) as InvoiceTemplate[];
      }

      return data.map(d => ({
        ...d,
        template_data: d.template_data as unknown as InvoiceTemplateData
      })) as InvoiceTemplate[];
    },
    enabled: !!tenant?.id
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Omit<InvoiceTemplate, "id" | "tenant_id" | "created_at" | "updated_at">) => {
      if (!tenant?.id) throw new Error("No tenant");

      const { data, error } = await supabase
        .from("invoice_templates")
        .insert([{
          tenant_id: tenant.id,
          name: template.name,
          description: template.description,
          template_data: template.template_data as unknown as Json,
          is_default: template.is_default,
          is_system: false
        }])
        .select()
        .maybeSingle();

      if (error) throw error;
      return { ...data, template_data: data.template_data as unknown as InvoiceTemplateData } as InvoiceTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoiceTemplates.byTenant(tenant?.id) });
      toast.success("Template created");
    },
    onError: (error: unknown) => toast.error("Failed to create template", { description: humanizeError(error) })
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InvoiceTemplate> & { id: string }) => {
      const updatePayload: Record<string, unknown> = {};
      if (updates.name !== undefined) updatePayload.name = updates.name;
      if (updates.description !== undefined) updatePayload.description = updates.description;
      if (updates.is_default !== undefined) updatePayload.is_default = updates.is_default;
      if (updates.template_data !== undefined) updatePayload.template_data = updates.template_data as unknown as Json;

      if (!tenant?.id) throw new Error("No tenant");
      const { data, error } = await supabase
        .from("invoice_templates")
        .update(updatePayload)
        .eq("id", id)
        .eq("tenant_id", tenant.id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return { ...data, template_data: data.template_data as unknown as InvoiceTemplateData } as InvoiceTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoiceTemplates.byTenant(tenant?.id) });
      toast.success("Template updated");
    },
    onError: (error: unknown) => toast.error("Failed to update template", { description: humanizeError(error) })
  });

  const setDefaultTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!tenant?.id) throw new Error("No tenant");

      // First, unset all defaults
      await supabase
        .from("invoice_templates")
        .update({ is_default: false })
        .eq("tenant_id", tenant.id);

      // Then set the new default
      const { error } = await supabase
        .from("invoice_templates")
        .update({ is_default: true })
        .eq("id", templateId)
        .eq("tenant_id", tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoiceTemplates.byTenant(tenant?.id) });
      toast.success("Default template updated");
    },
    onError: (error: unknown) => toast.error("Failed to set default template", { description: humanizeError(error) })
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!tenant?.id) throw new Error("No tenant");
      const { error } = await supabase
        .from("invoice_templates")
        .delete()
        .eq("id", templateId)
        .eq("tenant_id", tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoiceTemplates.byTenant(tenant?.id) });
      toast.success("Template deleted");
    },
    onError: (error: unknown) => toast.error("Failed to delete template", { description: humanizeError(error) })
  });

  const defaultTemplate = templates.find(t => t.is_default) || templates[0];

  return {
    templates,
    defaultTemplate,
    isLoading,
    createTemplate,
    updateTemplate,
    setDefaultTemplate,
    deleteTemplate
  };
}
