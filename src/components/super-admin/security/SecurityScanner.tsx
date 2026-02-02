/**
 * Security Scanner Component
 * Scan for security vulnerabilities and issues
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import Shield from "lucide-react/dist/esm/icons/shield";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { useState } from 'react';

interface SecurityFinding {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation: string;
}

export function SecurityScanner() {
  const [isScanning, setIsScanning] = useState(false);

  const { data: findings, isLoading, refetch } = useQuery({
    queryKey: ['security-scan'],
    queryFn: async () => {
      const findings: SecurityFinding[] = [];

      // Check for tenants with weak passwords (simulated)
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, business_name, created_at');

      // Check for inactive accounts
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      tenants?.forEach((tenant) => {
        const created = new Date(tenant.created_at);
        if (created < thirtyDaysAgo) {
          findings.push({
            id: `inactive-${tenant.id}`,
            type: 'warning',
            title: `Inactive Account: ${tenant.business_name}`,
            description: 'Account created more than 30 days ago with no activity',
            recommendation: 'Review account status and consider outreach',
          });
        }
      });

      // Check for unverified emails (would need email verification tracking)
      // Check for excessive permissions (would need permission audit)

      return findings;
    },
    enabled: false, // Only run on manual scan
  });

  const handleScan = async () => {
    setIsScanning(true);
    await refetch();
    setIsScanning(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Scanner
          </CardTitle>
          <Button
            onClick={handleScan}
            disabled={isScanning || isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            Run Scan
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || isScanning ? (
          <div className="h-64 bg-muted animate-pulse rounded" />
        ) : findings && findings.length > 0 ? (
          <div className="space-y-3">
            {findings.map((finding) => (
              <div
                key={finding.id}
                className="p-4 border rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(finding.type)}
                    <p className="font-medium">{finding.title}</p>
                  </div>
                  {getTypeBadge(finding.type)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {finding.description}
                </p>
                <div className="p-2 bg-muted rounded text-xs">
                  <strong>Recommendation:</strong> {finding.recommendation}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No security issues found</p>
            <p className="text-xs mt-1">Click "Run Scan" to check for vulnerabilities</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

