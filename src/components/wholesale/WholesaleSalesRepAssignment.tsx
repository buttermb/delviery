/**
 * Wholesale Sales Rep Assignment Component
 * Assign account managers/sales reps to wholesale clients
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UserCircle, Mail, Phone } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from '@/lib/queryKeys';
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface SalesRep {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}

interface WholesaleSalesRepAssignmentProps {
  clientId: string;
  currentRepId?: string;
}

export function WholesaleSalesRepAssignment({
  clientId,
  currentRepId,
}: WholesaleSalesRepAssignmentProps) {
  const [selectedRepId, setSelectedRepId] = useState(currentRepId || '');
  const queryClient = useQueryClient();

  // Fetch available sales reps
  const { data: salesReps = [] } = useQuery({
    queryKey: queryKeys.wholesaleSalesReps.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, first_name, last_name, email, phone')
        .eq('role', 'sales')
        .eq('is_active', true);

      if (error) throw error;
      return data as SalesRep[];
    },
  });

  // Fetch current rep details
  const { data: currentRep } = useQuery({
    queryKey: queryKeys.wholesaleSalesReps.detail(currentRepId),
    queryFn: async () => {
      if (!currentRepId) return null;

      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('id', currentRepId)
        .maybeSingle();

      if (error) throw error;
      return data as SalesRep | null;
    },
    enabled: !!currentRepId,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('marketplace_profiles')
        .update({ sales_rep_id: selectedRepId || null })
        .eq('id', clientId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Sales rep assigned successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceProfilesData.byClient(clientId) });
    },
    onError: (error) => {
      logger.error('Failed to assign sales rep', { error });
      toast.error('Failed to assign sales rep');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="h-5 w-5" />
          Account Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentRep && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <UserCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {currentRep.first_name} {currentRep.last_name}
                </p>
                {currentRep.email && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {currentRep.email}
                  </p>
                )}
                {currentRep.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {currentRep.phone}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="sales-rep">Assign Account Manager</Label>
          <Select value={selectedRepId} onValueChange={setSelectedRepId}>
            <SelectTrigger id="sales-rep">
              <SelectValue placeholder="Select a sales representative" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Unassigned</SelectItem>
              {salesReps.map((rep) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {rep.first_name} {rep.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full"
          onClick={() => assignMutation.mutate()}
          disabled={assignMutation.isPending || selectedRepId === currentRepId}
        >
          {assignMutation.isPending ? 'Saving...' : 'Update Assignment'}
        </Button>
      </CardContent>
    </Card>
  );
}
