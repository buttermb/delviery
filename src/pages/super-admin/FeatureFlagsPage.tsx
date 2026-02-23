import { logger } from '@/lib/logger';
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Flag, Plus, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';

export default function FeatureFlagsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  // Fetch feature flags from database
  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['super-admin-feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('id, flag_name, enabled, tenant_id, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get unique flag names and count tenants using each
      const flagMap = new Map<string, { id: string; name: string; enabled: boolean; tenants: number }>();
      
      data?.forEach((flag) => {
        const key = flag.flag_name || 'unknown';
        const existing = flagMap.get(key) || { 
          id: flag.id, 
          name: key, 
          enabled: flag.enabled || false, 
          tenants: 0 
        };
        if (flag.enabled) {
          existing.tenants += 1;
        }
        existing.enabled = existing.enabled || (flag.enabled || false);
        flagMap.set(key, existing);
      });

      return Array.from(flagMap.values()).map((flag, idx) => ({
        id: flag.id || `flag-${idx}`,
        name: flag.name,
        description: `Feature flag: ${flag.name.replace(/_/g, ' ')}`,
        enabled: flag.enabled,
        tenants: flag.tenants,
      }));
    },
    refetchInterval: 30000,
  });

  // Toggle feature flag mutation with optimistic UI
  const toggleMutation = useMutation({
    mutationFn: async ({ flagId, enabled }: { flagId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled })
        .eq('id', flagId);

      if (error) throw error;
    },
    onMutate: async ({ flagId, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['super-admin-feature-flags'] });
      const previousFlags = queryClient.getQueryData<typeof flags>(['super-admin-feature-flags']);
      queryClient.setQueryData<typeof flags>(['super-admin-feature-flags'], (old) => {
        if (!old) return old;
        return old.map((flag) =>
          flag.id === flagId ? { ...flag, enabled } : flag
        );
      });
      return { previousFlags };
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.previousFlags) {
        queryClient.setQueryData(['super-admin-feature-flags'], context.previousFlags);
      }
      logger.error('Failed to toggle feature flag', error);
      toast.error('Failed to update feature flag. Please try again.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-feature-flags'] });
    },
  });

  const filteredFlags = useMemo(() => {
    return flags.filter(flag =>
      flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [flags, searchTerm]);

  const toggleFlag = (id: string, currentEnabled: boolean) => {
    toggleMutation.mutate({ flagId: id, enabled: !currentEnabled });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🚩 Feature Flags</h1>
        <p className="text-sm text-muted-foreground">Control feature rollout & experimentation</p>
      </div>
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Total Flags</CardTitle>
              <Flag className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {isLoading ? '...' : flags.length}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Active features</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Enabled</CardTitle>
              <Flag className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {flags.filter(f => f.enabled).length}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Currently active</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Disabled</CardTitle>
              <Flag className="h-4 w-4 text-[hsl(var(--super-admin-accent))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {flags.filter(f => !f.enabled).length}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Not in use</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Tenants</CardTitle>
              <Flag className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {flags.reduce((sum, f) => sum + f.tenants, 0)}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Using features</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--super-admin-text))]/50" />
                <Input
                  placeholder="Search feature flags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-black/20 border-white/10 text-[hsl(var(--super-admin-text))]"
                />
              </div>
              <Button className="bg-[hsl(var(--super-admin-primary))] hover:bg-[hsl(var(--super-admin-primary))]/90">
                <Plus className="h-4 w-4 mr-2" />
                New Flag
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags Table */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">
              Feature Flags ({filteredFlags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Flag Name</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Description</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Tenants</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Status</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Toggle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlags.map((flag) => (
                    <TableRow key={flag.id} className="border-white/10">
                      <TableCell className="text-[hsl(var(--super-admin-text))] font-mono text-sm">{flag.name}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]/70">{flag.description}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{flag.tenants}</TableCell>
                      <TableCell>
                        <Badge className={flag.enabled 
                          ? 'bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]'
                          : 'bg-[hsl(var(--super-admin-text-light))]/20 text-[hsl(var(--super-admin-text-light))]'
                        }>
                          {flag.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={() => toggleFlag(flag.id, flag.enabled)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
