import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { PerformanceMonitor as PM } from '@/utils/performance';

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState(PM.getMetrics());
  const [memoryInfo, setMemoryInfo] = useState<any>(null);
  const [resourceTiming, setResourceTiming] = useState<PerformanceResourceTiming[]>([]);

  const refreshMetrics = () => {
    setMetrics(PM.getMetrics());
    
    if ((performance as any).memory) {
      setMemoryInfo((performance as any).memory);
    }

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    setResourceTiming(resources.slice(-20));
  };

  useEffect(() => {
    refreshMetrics();
    
    const interval = setInterval(refreshMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const getScoreColor = (value: number, thresholds: { good: number; fair: number }) => {
    if (value <= thresholds.good) return 'text-green-500';
    if (value <= thresholds.fair) return 'text-yellow-500';
    return 'text-destructive';
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (ms: number) => {
    return `${Math.round(ms)} ms`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Monitor</h1>
          <p className="text-muted-foreground">
            Real-time Core Web Vitals and resource monitoring
          </p>
        </div>
        <Button onClick={refreshMetrics} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">First Contentful Paint (FCP)</CardTitle>
            <CardDescription>Time until first content renders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(metrics.FCP || 0, { good: 1800, fair: 3000 })}`}>
              {metrics.FCP ? formatDuration(metrics.FCP) : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Good: &lt; 1.8s | Fair: &lt; 3.0s
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Largest Contentful Paint (LCP)</CardTitle>
            <CardDescription>Largest element render time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(metrics.LCP || 0, { good: 2500, fair: 4000 })}`}>
              {metrics.LCP ? formatDuration(metrics.LCP) : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Good: &lt; 2.5s | Fair: &lt; 4.0s
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">First Input Delay (FID)</CardTitle>
            <CardDescription>Time to first interaction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(metrics.FID || 0, { good: 100, fair: 300 })}`}>
              {metrics.FID ? formatDuration(metrics.FID) : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Good: &lt; 100ms | Fair: &lt; 300ms
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cumulative Layout Shift (CLS)</CardTitle>
            <CardDescription>Visual stability score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(metrics.CLS || 0, { good: 0.1, fair: 0.25 })}`}>
              {metrics.CLS !== undefined ? metrics.CLS.toFixed(3) : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Good: &lt; 0.1 | Fair: &lt; 0.25
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Time to First Byte (TTFB)</CardTitle>
            <CardDescription>Server response time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getScoreColor(metrics.TTFB || 0, { good: 800, fair: 1800 })}`}>
              {metrics.TTFB ? formatDuration(metrics.TTFB) : 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Good: &lt; 800ms | Fair: &lt; 1.8s
            </div>
          </CardContent>
        </Card>
      </div>

      {memoryInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Memory Usage</CardTitle>
            <CardDescription>JavaScript heap size</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Used</div>
                <div className="text-2xl font-bold">
                  {formatBytes(memoryInfo.usedJSHeapSize)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total</div>
                <div className="text-2xl font-bold">
                  {formatBytes(memoryInfo.totalJSHeapSize)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Limit</div>
                <div className="text-2xl font-bold">
                  {formatBytes(memoryInfo.jsHeapSizeLimit)}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${(memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100}%`
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Resources</CardTitle>
          <CardDescription>Last 20 loaded resources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {resourceTiming.map((resource, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {resource.name.split('/').pop() || resource.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {resource.initiatorType}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm font-bold">
                    {formatDuration(resource.duration)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(resource.transferSize || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
