/**
 * Button Health Monitoring Panel
 * Displays button statistics, errors, and broken buttons
 * Accessible via debug mode or admin panel
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Trash2,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { buttonMonitor } from '@/lib/utils/buttonMonitor';
import { logger } from '@/lib/logger';

export function ButtonHealthPanel() {
  const [stats, setStats] = useState(buttonMonitor.getStats());
  const [healthReport, setHealthReport] = useState(buttonMonitor.getHealthReport());
  const [recentErrors, setRecentErrors] = useState(buttonMonitor.getRecentErrors(20));
  const [brokenButtons, setBrokenButtons] = useState(buttonMonitor.getBrokenButtons(0.3));
  const [autoRefresh, setAutoRefresh] = useState(false);

  const refresh = () => {
    setStats(buttonMonitor.getStats());
    setHealthReport(buttonMonitor.getHealthReport());
    setRecentErrors(buttonMonitor.getRecentErrors(20));
    setBrokenButtons(buttonMonitor.getBrokenButtons(0.3));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const exportData = () => {
    const data = buttonMonitor.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `button-monitor-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearData = () => {
    if (confirm('Clear all button monitoring data?')) {
      buttonMonitor.clear();
      refresh();
      logger.info('Button monitor data cleared', { component: 'ButtonHealthPanel' });
    }
  };

  const getStatusBadge = (stat: typeof stats[0]) => {
    const errorRate = stat.totalClicks > 0 ? stat.errorCount / stat.totalClicks : 0;
    if (errorRate >= 0.5) {
      return <Badge variant="destructive">Broken ({Math.round(errorRate * 100)}% errors)</Badge>;
    } else if (errorRate >= 0.2) {
      return <Badge variant="secondary">Warning ({Math.round(errorRate * 100)}% errors)</Badge>;
    } else {
      return <Badge variant="default">Healthy</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Button Health Monitor</h1>
          <p className="text-muted-foreground">
            Track button interactions, errors, and identify broken buttons
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={clearData} variant="outline" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Health Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Buttons</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthReport.totalButtons}</div>
            <p className="text-xs text-muted-foreground">
              {healthReport.totalClicks} total clicks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(healthReport.successRate * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(healthReport.successRate * healthReport.totalClicks)} successful
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(healthReport.errorRate * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(healthReport.errorRate * healthReport.totalClicks)} errors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Broken Buttons</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthReport.brokenButtons}</div>
            <p className="text-xs text-muted-foreground">
              {healthReport.recentErrors} recent errors
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="broken" className="w-full">
        <TabsList>
          <TabsTrigger value="broken">
            Broken Buttons ({brokenButtons.length})
          </TabsTrigger>
          <TabsTrigger value="recent">Recent Errors ({recentErrors.length})</TabsTrigger>
          <TabsTrigger value="all">All Buttons ({stats.length})</TabsTrigger>
          <TabsTrigger value="top-errors">Top Errors</TabsTrigger>
        </TabsList>

        {/* Broken Buttons Tab */}
        <TabsContent value="broken" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Broken Buttons (Error Rate ≥ 30%)</CardTitle>
            </CardHeader>
            <CardContent>
              {brokenButtons.length === 0 ? (
                <p className="text-muted-foreground">No broken buttons detected! 🎉</p>
              ) : (
                <div className="space-y-4">
                  {brokenButtons.map((stat) => {
                    const errorRate = stat.totalClicks > 0
                      ? stat.errorCount / stat.totalClicks
                      : 0;
                    return (
                      <div
                        key={`${stat.component}-${stat.action}`}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">
                              {stat.component}.{stat.action}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Button ID: {stat.buttonId}
                            </div>
                          </div>
                          {getStatusBadge(stat)}
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Total Clicks</div>
                            <div className="font-semibold">{stat.totalClicks}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Errors</div>
                            <div className="font-semibold text-red-600">
                              {stat.errorCount} ({Math.round(errorRate * 100)}%)
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Success</div>
                            <div className="font-semibold text-green-600">
                              {stat.successCount}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Avg Duration</div>
                            <div className="font-semibold">
                              {stat.averageDuration
                                ? `${Math.round(stat.averageDuration)}ms`
                                : 'N/A'}
                            </div>
                          </div>
                        </div>
                        {stat.lastError && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm">
                            <div className="font-semibold text-red-800 dark:text-red-200">
                              Last Error:
                            </div>
                            <div className="text-red-700 dark:text-red-300">
                              {stat.lastError}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {stat.lastErrorTime
                                ? new Date(stat.lastErrorTime).toLocaleString()
                                : 'Unknown'}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Errors Tab */}
        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
            </CardHeader>
            <CardContent>
              {recentErrors.length === 0 ? (
                <p className="text-muted-foreground">No recent errors! 🎉</p>
              ) : (
                <div className="space-y-2">
                  {recentErrors.map((error, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-3 space-y-1 bg-red-50 dark:bg-red-950"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">
                          {error.component}.{error.action}
                        </div>
                        <Badge variant="destructive">Error</Badge>
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300">
                        {error.error || 'Unknown error'}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(error.timestamp).toLocaleString()}
                        </span>
                        {error.duration && (
                          <span>Duration: {error.duration}ms</span>
                        )}
                        {error.url && (
                          <span className="truncate max-w-xs">URL: {error.url}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Buttons Tab */}
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Button Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats
                  .sort((a, b) => b.totalClicks - a.totalClicks)
                  .map((stat) => {
                    const errorRate = stat.totalClicks > 0
                      ? stat.errorCount / stat.totalClicks
                      : 0;
                    return (
                      <div
                        key={`${stat.component}-${stat.action}`}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">
                              {stat.component}.{stat.action}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {stat.buttonId}
                            </div>
                          </div>
                          {getStatusBadge(stat)}
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-xs">
                          <div>
                            <div className="text-muted-foreground">Clicks</div>
                            <div className="font-semibold">{stat.totalClicks}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Success</div>
                            <div className="font-semibold text-green-600">
                              {stat.successCount}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Errors</div>
                            <div className="font-semibold text-red-600">
                              {stat.errorCount}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Timeouts</div>
                            <div className="font-semibold text-orange-600">
                              {stat.timeoutCount}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Avg Time</div>
                            <div className="font-semibold">
                              {stat.averageDuration
                                ? `${Math.round(stat.averageDuration)}ms`
                                : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Errors Tab */}
        <TabsContent value="top-errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Errors by Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              {healthReport.topErrors.length === 0 ? (
                <p className="text-muted-foreground">No errors recorded! 🎉</p>
              ) : (
                <div className="space-y-2">
                  {healthReport.topErrors.map((error, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{error.button}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {error.lastError}
                        </div>
                      </div>
                      <Badge variant="destructive">{error.count} errors</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

