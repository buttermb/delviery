/**
 * Module Connection Health Report
 *
 * Displays pass/fail results for each module interconnection check.
 * Run on demand via a button. Shows each connection with status badge.
 */

import { useMemo } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Circle, RefreshCw } from 'lucide-react';

import type { ConnectionCheck, ConnectionStatus } from '@/hooks/useModuleConnections';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useModuleConnections } from '@/hooks/useModuleConnections';

const STATUS_CONFIG: Record<ConnectionStatus, { icon: typeof CheckCircle; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pass: { icon: CheckCircle, label: 'Pass', variant: 'default' },
  fail: { icon: XCircle, label: 'Fail', variant: 'destructive' },
  warn: { icon: AlertTriangle, label: 'Warning', variant: 'secondary' },
  pending: { icon: Circle, label: 'Pending', variant: 'outline' },
};

function ConnectionRow({ check }: { check: ConnectionCheck }) {
  const config = STATUS_CONFIG[check.status];
  const Icon = config.icon;

  return (
    <div className="flex items-start justify-between py-3 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 flex-shrink-0 ${
            check.status === 'pass' ? 'text-green-600' :
            check.status === 'fail' ? 'text-red-600' :
            check.status === 'warn' ? 'text-yellow-600' :
            'text-muted-foreground'
          }`} />
          <span className="text-sm font-medium">{check.label}</span>
          <Badge variant={config.variant} className="text-xs">
            {config.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-6">{check.description}</p>
        {check.detail && (
          <p className={`text-xs mt-0.5 ml-6 ${
            check.status === 'fail' ? 'text-red-600' :
            check.status === 'warn' ? 'text-yellow-700' :
            'text-muted-foreground'
          }`}>
            {check.detail}
          </p>
        )}
      </div>
      {check.checkedAt && (
        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
          {check.checkedAt.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

export function ModuleConnectionHealthReport() {
  const { checks, isRunning, runAll, passCount, failCount, warnCount } = useModuleConnections();

  const hasResults = useMemo(
    () => checks.some((c) => c.checkedAt !== null),
    [checks]
  );

  const summaryText = hasResults
    ? `${passCount} pass, ${failCount} fail, ${warnCount} warn`
    : 'Not run yet';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Module Connections</CardTitle>
            <CardDescription>{summaryText}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runAll}
            disabled={isRunning}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Checking...' : 'Run Checks'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {checks.map((check) => (
            <ConnectionRow key={check.id} check={check} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
