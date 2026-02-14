/**
 * Comprehensive Bug Scanner Component
 * Displays and monitors all application errors
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import bugFinder, { BugReport, BugScanResult } from '@/utils/bugFinder';
import { AlertTriangle, RefreshCw, Download, Trash2, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function BugScanner() {
  const [scanResult, setScanResult] = useState<BugScanResult | null>(null);
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const performScan = () => {
    const result = bugFinder.scanBugs();
    setScanResult(result);
  };

  useEffect(() => {
    performScan();

    // Subscribe to new bugs
    const unsubscribe = bugFinder.onBugReport(() => {
      performScan();
    });

    // Auto-refresh if enabled
    let interval: number | undefined;
    if (autoRefresh) {
      interval = window.setInterval(performScan, 5000);
    }

    return () => {
      unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getSeverityColor = (severity: BugReport['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-destructive';
      case 'high': return 'bg-orange-600 dark:bg-orange-700';
      case 'medium': return 'bg-orange-500 dark:bg-orange-600';
      case 'low': return 'bg-accent';
      default: return 'bg-muted';
    }
  };

  const getTypeIcon = (type: BugReport['type']) => {
    switch (type) {
      case 'api': return <XCircle className="w-4 h-4" />;
      case '404': return <AlertCircle className="w-4 h-4" />;
      case 'fetch': return <AlertTriangle className="w-4 h-4" />;
      case 'edge': return <AlertCircle className="w-4 h-4" />;
      case 'realtime': return <Info className="w-4 h-4" />;
      case 'promise': return <XCircle className="w-4 h-4" />;
      case 'runtime': return <AlertTriangle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const exportReport = () => {
    if (!scanResult) return;
    const data = bugFinder.exportBugs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bug-report-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bug report exported');
  };

  const clearBugs = () => {
    bugFinder.clearBugs();
    performScan();
    toast.success('Bug logs cleared');
  };

  const commonIssues = scanResult ? bugFinder.checkCommonIssues() : null;

  if (!scanResult) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Loading bug scanner...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bug Scanner & Error Monitor</CardTitle>
              <CardDescription>
                Comprehensive error monitoring and debugging tool
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
              </Button>
              <Button variant="outline" size="sm" onClick={performScan}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Scan Now
              </Button>
              <Button variant="outline" size="sm" onClick={exportReport}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="destructive" size="sm" onClick={clearBugs}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{scanResult.critical}</div>
                <div className="text-sm text-muted-foreground">Critical</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">{scanResult.high}</div>
                <div className="text-sm text-muted-foreground">High</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{scanResult.medium}</div>
                <div className="text-sm text-muted-foreground">Medium</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{scanResult.totalBugs}</div>
                <div className="text-sm text-muted-foreground">Total Bugs</div>
              </CardContent>
            </Card>
          </div>

          {/* Error Type Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
            <Badge variant="secondary">API: {scanResult.summary.apiErrors}</Badge>
            <Badge variant="secondary">404: {scanResult.summary.notFoundErrors}</Badge>
            <Badge variant="secondary">Fetch: {scanResult.summary.fetchErrors}</Badge>
            <Badge variant="secondary">Edge: {scanResult.summary.edgeErrors}</Badge>
            <Badge variant="secondary">Realtime: {scanResult.summary.realtimeErrors}</Badge>
            <Badge variant="secondary">Promise: {scanResult.summary.promiseRejections}</Badge>
            <Badge variant="secondary">Runtime: {scanResult.summary.runtimeErrors}</Badge>
          </div>

          {/* Common Issues */}
          {commonIssues && commonIssues.issues.length > 0 && (
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Common Issues Detected</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {commonIssues.issues.map((issue, i) => (
                    <li key={i}>
                      <strong>{issue.severity.toUpperCase()}:</strong> {issue.message}
                    </li>
                  ))}
                </ul>
                {commonIssues.recommendations.length > 0 && (
                  <div className="mt-4">
                    <strong>Recommendations:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {commonIssues.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Bugs ({scanResult.totalBugs})</TabsTrigger>
              <TabsTrigger value="critical">Critical ({scanResult.critical})</TabsTrigger>
              <TabsTrigger value="high">High ({scanResult.high})</TabsTrigger>
              <TabsTrigger value="api">API Errors ({scanResult.summary.apiErrors})</TabsTrigger>
              <TabsTrigger value="404">404s ({scanResult.summary.notFoundErrors})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <BugList 
                bugs={scanResult.bugs} 
                onSelect={setSelectedBug}
                selectedBug={selectedBug}
              />
            </TabsContent>

            <TabsContent value="critical" className="space-y-4">
              <BugList 
                bugs={scanResult.bugs.filter(b => b.severity === 'critical')} 
                onSelect={setSelectedBug}
                selectedBug={selectedBug}
              />
            </TabsContent>

            <TabsContent value="high" className="space-y-4">
              <BugList 
                bugs={scanResult.bugs.filter(b => b.severity === 'high')} 
                onSelect={setSelectedBug}
                selectedBug={selectedBug}
              />
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <BugList 
                bugs={scanResult.bugs.filter(b => b.type === 'api')} 
                onSelect={setSelectedBug}
                selectedBug={selectedBug}
              />
            </TabsContent>

            <TabsContent value="404" className="space-y-4">
              <BugList 
                bugs={scanResult.bugs.filter(b => b.type === '404')} 
                onSelect={setSelectedBug}
                selectedBug={selectedBug}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Bug Detail Sidebar */}
      {selectedBug && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTypeIcon(selectedBug.type)}
              Bug Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <strong>Type:</strong> <Badge>{selectedBug.type}</Badge>
              </div>
              <div>
                <strong>Severity:</strong>{' '}
                <Badge className={getSeverityColor(selectedBug.severity)}>
                  {selectedBug.severity}
                </Badge>
              </div>
              <div>
                <strong>Message:</strong>
                <div className="mt-1 p-2 bg-muted rounded text-sm">
                  {selectedBug.message}
                </div>
              </div>
              {selectedBug.url && (
                <div>
                  <strong>URL:</strong>
                  <div className="mt-1 p-2 bg-muted rounded text-sm break-all">
                    {selectedBug.url}
                  </div>
                </div>
              )}
              {selectedBug.statusCode && (
                <div>
                  <strong>Status Code:</strong> {selectedBug.statusCode}
                </div>
              )}
              {selectedBug.stack && (
                <div>
                  <strong>Stack Trace:</strong>
                  <ScrollArea className="h-40 mt-1">
                    <pre className="p-2 bg-muted rounded text-xs">
                      {selectedBug.stack}
                    </pre>
                  </ScrollArea>
                </div>
              )}
              {selectedBug.context && Object.keys(selectedBug.context).length > 0 && (
                <div>
                  <strong>Context:</strong>
                  <pre className="p-2 bg-muted rounded text-xs mt-1 overflow-auto">
                    {JSON.stringify(selectedBug.context, null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <strong>Timestamp:</strong> {new Date(selectedBug.timestamp).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BugList({ 
  bugs, 
  onSelect, 
  selectedBug 
}: { 
  bugs: BugReport[]; 
  onSelect: (bug: BugReport) => void;
  selectedBug: BugReport | null;
}) {
  const getSeverityColor = (severity: BugReport['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-destructive';
      case 'high': return 'bg-orange-600 dark:bg-orange-700';
      case 'medium': return 'bg-orange-500 dark:bg-orange-600';
      case 'low': return 'bg-accent';
      default: return 'bg-muted';
    }
  };

  if (bugs.length === 0) {
    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>No bugs found</AlertTitle>
        <AlertDescription>
          No bugs of this type have been detected.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-2">
        {bugs.map((bug) => (
          <Card
            key={bug.id}
            className={`cursor-pointer hover:bg-muted transition-colors ${
              selectedBug?.id === bug.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onSelect(bug)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getSeverityColor(bug.severity)}>
                      {bug.severity}
                    </Badge>
                    <Badge variant="outline">{bug.type}</Badge>
                    {bug.statusCode && (
                      <Badge variant="secondary">HTTP {bug.statusCode}</Badge>
                    )}
                  </div>
                  <div className="text-sm font-medium mb-1">
                    {bug.message}
                  </div>
                  {bug.url && (
                    <div className="text-xs text-muted-foreground truncate">
                      {bug.url}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(bug.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

