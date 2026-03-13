/**
 * Wholesale Client Onboarding Checklist Component
 * Track onboarding progress for new wholesale clients
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  required: boolean;
}

interface WholesaleClientOnboardingChecklistProps {
  clientId: string;
}

const defaultChecklist: Omit<ChecklistItem, 'id' | 'completed'>[] = [
  {
    label: 'License Verified',
    description: 'Business license and cannabis license verified',
    required: true,
  },
  {
    label: 'Credit Check Completed',
    description: 'Credit check run and credit limit established',
    required: true,
  },
  {
    label: 'Terms & Conditions Agreed',
    description: 'Client has signed wholesale terms and conditions',
    required: true,
  },
  {
    label: 'Payment Method Added',
    description: 'Valid payment method on file',
    required: true,
  },
  {
    label: 'First Order Placed',
    description: 'Initial order placed successfully',
    required: false,
  },
  {
    label: 'Account Manager Assigned',
    description: 'Sales representative assigned to account',
    required: false,
  },
  {
    label: 'Pricing Tiers Configured',
    description: 'Volume discount tiers set up',
    required: false,
  },
];

export function WholesaleClientOnboardingChecklist({
  clientId,
}: WholesaleClientOnboardingChecklistProps) {
  const queryClient = useQueryClient();

  const { data: checklist = [], isLoading } = useQuery({
    queryKey: ['client-onboarding', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_onboarding_checklist')
        .select('*')
        .eq('client_id', clientId);

      if (error) throw error;

      // Merge with default checklist
      const checklistData = defaultChecklist.map(item => {
        const saved = data?.find(d => d.item_key === item.label);
        return {
          id: saved?.id || `new-${item.label}`,
          label: item.label,
          description: item.description,
          required: item.required,
          completed: saved?.completed || false,
        };
      });

      return checklistData as ChecklistItem[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ itemLabel, completed }: { itemLabel: string; completed: boolean }) => {
      const { error } = await supabase
        .from('client_onboarding_checklist')
        .upsert({
          client_id: clientId,
          item_key: itemLabel,
          completed,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-onboarding', clientId] });
    },
    onError: (error) => {
      logger.error('Failed to update checklist', { error });
      toast.error('Failed to update checklist');
    },
  });

  const completedCount = checklist.filter(item => item.completed).length;
  const totalCount = checklist.length;
  const requiredCount = checklist.filter(item => item.required).length;
  const requiredCompletedCount = checklist.filter(item => item.required && item.completed).length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isFullyOnboarded = requiredCompletedCount === requiredCount;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Onboarding Checklist</span>
          {isFullyOnboarded ? (
            <Badge className="bg-success text-white">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Complete
            </Badge>
          ) : (
            <Badge variant="outline">
              {requiredCompletedCount}/{requiredCount} Required
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="text-xs text-muted-foreground">
            {completedCount} of {totalCount} items completed
          </div>
        </div>

        <div className="space-y-3">
          {checklist.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                id={item.id}
                checked={item.completed}
                onCheckedChange={(checked) => {
                  toggleMutation.mutate({
                    itemLabel: item.label,
                    completed: checked as boolean,
                  });
                }}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <label
                    htmlFor={item.id}
                    className={`font-medium cursor-pointer ${
                      item.completed ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {item.label}
                  </label>
                  {item.required && (
                    <Badge variant="outline" className="text-xs">Required</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-1" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
              )}
            </div>
          ))}
        </div>

        {!isFullyOnboarded && (
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm">
            <p className="text-warning-foreground">
              Complete all required items to activate full account features.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
