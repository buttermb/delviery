/**
 * Rate Limit Manager
 * Configure rate limits per tenant and view violations
 * Inspired by Kong rate limiting plugins
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shield, AlertTriangle, Save, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RateLimit {
  tenant_id: string;
  requests_per_hour: number;
  requests_per_day: number;
  requests_per_month: number;
  custom_limits: Record<string, any>;
  tenants?: {
    business_name: string;
    slug: string;
  };
}

interface RateLimitViolation {
  id: string;
  tenant_id: string;
  endpoint: string;
  violation_type: string;
  timestamp: string;
  current_count: number;
  limit_value: number;
  tenants?: {
    business_name: string;
  };
}

export function RateLimitManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTenant, setSelectedTenant] = useState<string>('');

  // Fetch all rate limits
  const { data: rateLimits, isLoading } = useQuery({
    queryKey: ['rate-limits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_limits')
        .select('*, tenants(business_name, slug)')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as RateLimit[];
    },
  });

  // Fetch recent violations
  const { data: violations, isLoading: violationsLoading } = useQuery({
    queryKey: ['rate-limit-violations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_limit_violations')
        .select('*, tenants(business_name)')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as RateLimitViolation[];
    },
  });

  // Update rate limit mutation
  const updateMutation = useMutation({
    mutationFn: async (data: {
      tenantId: string;
      requestsPerHour: number;
      requestsPerDay: number;
      requestsPerMonth: number;
    }) => {
      const { error } = await supabase
        .from('rate_limits')
        .upsert({
          tenant_id: data.tenantId,
          requests_per_hour: data.requestsPerHour,
          requests_per_day: data.requestsPerDay,
          requests_per_month: data.requestsPerMonth,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-limits'] });
      toast({
        title: 'Success',
        description: 'Rate limits updated',
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rate Limit Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-64 bg-muted animate-pulse rounded" />
          ) : (
            <div className="space-y-4">
              {rateLimits && rateLimits.length > 0 ? (
                <div className="space-y-4">
                  {rateLimits.map((limit) => (
                    <div
                      key={limit.tenant_id}
                      className="p-4 border rounded-lg space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">
                            {(limit.tenants as any)?.business_name || limit.tenant_id}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(limit.tenants as any)?.slug || 'N/A'}
                          </p>
                        </div>
                        <Badge variant="outline">Configured</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label>Requests/Hour</Label>
                          <Input
                            type="number"
                            value={limit.requests_per_hour}
                            onChange={(e) => {
                              // Update logic would go here
                            }}
                          />
                        </div>
                        <div>
                          <Label>Requests/Day</Label>
                          <Input
                            type="number"
                            value={limit.requests_per_day}
                            onChange={(e) => {
                              // Update logic would go here
                            }}
                          />
                        </div>
                        <div>
                          <Label>Requests/Month</Label>
                          <Input
                            type="number"
                            value={limit.requests_per_month}
                            onChange={(e) => {
                              // Update logic would go here
                            }}
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          updateMutation.mutate({
                            tenantId: limit.tenant_id,
                            requestsPerHour: limit.requests_per_hour,
                            requestsPerDay: limit.requests_per_day,
                            requestsPerMonth: limit.requests_per_month,
                          });
                        }}
                        disabled={updateMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No rate limits configured</p>
                  <p className="text-xs mt-1">Default limits apply to all tenants</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Violations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Recent Violations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {violationsLoading ? (
            <div className="h-64 bg-muted animate-pulse rounded" />
          ) : violations && violations.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.map((violation) => (
                    <TableRow key={violation.id}>
                      <TableCell>
                        {(violation.tenants as any)?.business_name || violation.tenant_id}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {violation.endpoint}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{violation.violation_type}</Badge>
                      </TableCell>
                      <TableCell>{violation.current_count}</TableCell>
                      <TableCell>{violation.limit_value}</TableCell>
                      <TableCell>
                        {new Date(violation.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No violations</p>
              <p className="text-xs mt-1">All tenants are within rate limits</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

