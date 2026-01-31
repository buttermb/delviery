/**
 * Admin Audit Panel
 *
 * Visual interface for running comprehensive admin panel audits.
 * Shows all issues with fixes and allows re-running checks.
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SkipForward,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Database,
  Server,
  Shield,
  ShoppingCart,
  Users,
  Package,
  Loader2,
  Clipboard,
  Download,
  Zap,
} from 'lucide-react';
import { runAdminAudit, quickHealthCheck, type AuditReport, type AuditResult } from '@/utils/adminPanelAudit';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const categoryIcons: Record<string, React.ReactNode> = {
  'Database': <Database className="h-4 w-4" />,
  'Edge Functions': <Server className="h-4 w-4" />,
  'Roles & Permissions': <Shield className="h-4 w-4" />,
  'Orders': <ShoppingCart className="h-4 w-4" />,
  'Authentication': <Shield className="h-4 w-4" />,
  'Inventory': <Package className="h-4 w-4" />,
  'Customers': <Users className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  pass: 'text-green-600 bg-green-50 border-green-200',
  fail: 'text-red-600 bg-red-50 border-red-200',
  warn: 'text-amber-600 bg-amber-50 border-amber-200',
  skip: 'text-gray-500 bg-gray-50 border-gray-200',
};

const statusIcons: Record<string, React.ReactNode> = {
  pass: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  fail: <XCircle className="h-4 w-4 text-red-600" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  skip: <SkipForward className="h-4 w-4 text-gray-500" />,
};

function AuditResultItem({ result }: { result: AuditResult }) {
  const [isOpen, setIsOpen] = useState(result.status === 'fail');

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50',
            statusColors[result.status]
          )}
        >
          {statusIcons[result.status]}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{result.check}</p>
            <p className="text-xs text-muted-foreground truncate">{result.message}</p>
          </div>
          {(result.fix || result.details) && (
            <div className="flex-shrink-0">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          )}
        </div>
      </CollapsibleTrigger>
      {(result.fix || result.details) && (
        <CollapsibleContent>
          <div className="mt-2 ml-7 p-3 bg-muted/30 rounded-lg space-y-2">
            {result.fix && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Suggested Fix:</p>
                <p className="text-sm font-mono bg-background p-2 rounded border">{result.fix}</p>
              </div>
            )}
            {result.details && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Details:</p>
                <pre className="text-xs font-mono bg-background p-2 rounded border overflow-x-auto">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function CategorySection({
  category,
  results,
}: {
  category: string;
  results: AuditResult[];
}) {
  const [isOpen, setIsOpen] = useState(true);
  const failCount = results.filter(r => r.status === 'fail').length;
  const warnCount = results.filter(r => r.status === 'warn').length;

  return (
    <Card className={cn(failCount > 0 && 'border-red-200')}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              {categoryIcons[category] || <Database className="h-4 w-4" />}
              <CardTitle className="text-base flex-1">{category}</CardTitle>
              <div className="flex items-center gap-2">
                {failCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {failCount} failed
                  </Badge>
                )}
                {warnCount > 0 && (
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                    {warnCount} warnings
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {results.length} checks
                </Badge>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {results.map((result, idx) => (
              <AuditResultItem key={`${result.check}-${idx}`} result={result} />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function AdminAuditPanel() {
  const { tenant } = useTenantAdminAuth();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isQuickChecking, setIsQuickChecking] = useState(false);

  const runAudit = useCallback(async () => {
    setIsRunning(true);
    try {
      const result = await runAdminAudit(tenant?.id);
      setReport(result);

      if (result.failed > 0) {
        toast.error(`Audit complete: ${result.failed} issues found`, {
          description: 'Check the critical issues section for details',
        });
      } else if (result.warnings > 0) {
        toast.warning(`Audit complete: ${result.warnings} warnings`, {
          description: 'Review warnings for potential issues',
        });
      } else {
        toast.success('All checks passed!', {
          description: `${result.passed} checks completed successfully`,
        });
      }
    } catch (error) {
      toast.error('Audit failed to complete', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRunning(false);
    }
  }, [tenant?.id]);

  const runQuickCheck = useCallback(async () => {
    setIsQuickChecking(true);
    try {
      const { healthy, issues } = await quickHealthCheck();
      if (healthy) {
        toast.success('System healthy', {
          description: 'All critical checks passed',
        });
      } else {
        toast.error('Issues detected', {
          description: issues.join(', '),
        });
      }
    } catch (error) {
      toast.error('Health check failed');
    } finally {
      setIsQuickChecking(false);
    }
  }, []);

  const copyReport = useCallback(() => {
    if (!report) return;
    const text = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(text);
    toast.success('Report copied to clipboard');
  }, [report]);

  const downloadReport = useCallback(() => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-audit-${report.timestamp.replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  }, [report]);

  // Group results by category
  const groupedResults = report?.results.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, AuditResult[]>) || {};

  const passRate = report ? Math.round((report.passed / report.totalChecks) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel Audit</h1>
          <p className="text-muted-foreground">
            Comprehensive health check of all admin panel systems
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={runQuickCheck}
            disabled={isRunning || isQuickChecking}
          >
            {isQuickChecking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Quick Check
          </Button>
          <Button onClick={runAudit} disabled={isRunning}>
            {isRunning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Full Audit
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      {report && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Audit Summary</CardTitle>
                <CardDescription>
                  Last run: {new Date(report.timestamp).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={copyReport}>
                  <Clipboard className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={downloadReport}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Pass Rate</span>
                  <span className="font-medium">{passRate}%</span>
                </div>
                <Progress
                  value={passRate}
                  className={cn(
                    passRate === 100 && '[&>div]:bg-green-500',
                    passRate >= 80 && passRate < 100 && '[&>div]:bg-amber-500',
                    passRate < 80 && '[&>div]:bg-red-500'
                  )}
                />
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-2xl font-bold text-green-600">{report.passed}</p>
                  <p className="text-xs text-green-700">Passed</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-2xl font-bold text-red-600">{report.failed}</p>
                  <p className="text-xs text-red-700">Failed</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-2xl font-bold text-amber-600">{report.warnings}</p>
                  <p className="text-xs text-amber-700">Warnings</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-2xl font-bold text-gray-600">{report.totalChecks}</p>
                  <p className="text-xs text-gray-700">Total Checks</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Issues */}
      {report && report.criticalIssues.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Critical Issues ({report.criticalIssues.length})
            </CardTitle>
            <CardDescription className="text-red-600">
              These issues must be resolved for the admin panel to function correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.criticalIssues.map((result, idx) => (
              <AuditResultItem key={`critical-${idx}`} result={result} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Results by Category */}
      {report && (
        <ScrollArea className="h-[600px]">
          <div className="space-y-4 pr-4">
            {Object.entries(groupedResults).map(([category, results]) => (
              <CategorySection key={category} category={category} results={results} />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* No Report State */}
      {!report && !isRunning && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No audit results yet</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Run a full audit to check all database tables, edge functions, permissions,
              and system integrations.
            </p>
            <Button onClick={runAudit}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Full Audit
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Running State */}
      {isRunning && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-medium mb-2">Running audit...</h3>
            <p className="text-muted-foreground text-center">
              Checking database tables, edge functions, and system health
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
