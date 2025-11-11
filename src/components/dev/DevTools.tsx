import { useState, useEffect, useRef } from 'react';
import { Bug, X, Trash2, Download, Terminal, Network, AlertTriangle, Database, Gauge, Copy, Filter, ArrowDown, Check, Pin, Maximize2, Minimize2, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import bugFinder from '@/utils/bugFinder';

interface LogEntry {
  id: number;
  timestamp: Date;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  args: unknown[];
  stack?: string;
}

interface NetworkEntry {
  id: number;
  timestamp: Date;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  error?: string;
  requestBody?: unknown;
  responseBody?: unknown;
}

// Global stores for logs and network requests
const globalLogs: LogEntry[] = [];
const globalNetwork: NetworkEntry[] = [];
let logId = 0;
let networkId = 0;
let intercepted = false;

// Initialize interception once globally
if (!intercepted) {
  intercepted = true;
  
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  const addLog = (type: LogEntry['type'], args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');

    globalLogs.push({
      id: logId++,
      timestamp: new Date(),
      type,
      message,
      args,
      stack: type === 'error' ? new Error().stack : undefined,
    });
    
    // Keep only last 1000 logs
    if (globalLogs.length > 1000) {
      globalLogs.shift();
    }
  };

  console.log = (...args) => {
    originalLog(...args);
    addLog('log', args);
  };

  console.warn = (...args) => {
    originalWarn(...args);
    addLog('warn', args);
  };

  console.error = (...args) => {
    originalError(...args);
    addLog('error', args);
  };

  console.info = (...args) => {
    originalInfo(...args);
    addLog('info', args);
  };

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const [url, options] = args;
    const startTime = Date.now();
    const id = networkId++;

    interface FetchOptions {
      method?: string;
      body?: unknown;
      [key: string]: unknown;
    }

    const fetchOptions = (options as FetchOptions | undefined);
    const networkEntry: NetworkEntry = {
      id,
      timestamp: new Date(),
      method: fetchOptions?.method || 'GET',
      url: typeof url === 'string' ? url : url.toString(),
      requestBody: fetchOptions?.body,
    };

    try {
      const response = await originalFetch(...args);
      const duration = Date.now() - startTime;
      
      // Clone response to read body
      const clonedResponse = response.clone();
      let responseBody;
      try {
        responseBody = await clonedResponse.text();
        try {
          responseBody = JSON.parse(responseBody);
        } catch {
          // Not valid JSON, keep as string
        }
      } catch {
        // Failed to read response body
      }

      globalNetwork.push({
        ...networkEntry,
        status: response.status,
        duration,
        responseBody,
      });
      
      if (globalNetwork.length > 100) {
        globalNetwork.shift();
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      globalNetwork.push({
        ...networkEntry,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (globalNetwork.length > 100) {
        globalNetwork.shift();
      }
      
      throw error;
    }
  };

  // Global error handlers - enhanced with bugFinder integration
  window.addEventListener('error', (event: ErrorEvent) => {
    addLog('error', [event.message, event.error]);
    
    // Also report to bugFinder
    if (event.error) {
      bugFinder.reportRuntimeError(
        event.error instanceof Error ? event.error : new Error(event.message),
        'GlobalErrorHandler',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      );
    } else {
      bugFinder.reportRuntimeError(
        new Error(event.message),
        'GlobalErrorHandler',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      );
    }
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    addLog('error', ['Unhandled Promise Rejection:', event.reason]);
    
    // Report to bugFinder (as promise rejection)
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    // Promise rejections are tracked automatically by bugFinder's global handlers
    // This will be caught by the unhandledrejection listener in bugFinder
  });

  // Track React errors via ErrorBoundary
  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError(...args);
    
    // Check if it's a React error
    const errorStr = args.join(' ');
    if (errorStr.includes('ErrorBoundary') || 
        errorStr.includes('React') || 
        errorStr.includes('component') ||
        errorStr.includes('Warning:')) {
      addLog('error', args);
    }
  };
}

interface PerformanceData {
  loadTime: number;
  domReady: number;
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  resources: number;
  navigation: PerformanceNavigationTiming;
}

export const DevTools = () => {
  // Hooks must be called before any conditional returns
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([...globalLogs]);
  const [network, setNetwork] = useState<NetworkEntry[]>([...globalNetwork]);
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('logs');
  const [typeFilter, setTypeFilter] = useState<LogEntry['type'] | 'all'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [storage, setStorage] = useState<Record<string, unknown>>({});
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkEntry | null>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const networkScrollRef = useRef<HTMLDivElement>(null);
  
  // Only show in development - disable in production to prevent errors
  if (import.meta.env.PROD) return null;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + D to toggle
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Ctrl/Cmd + K to clear logs
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && isOpen) {
        e.preventDefault();
        clearLogs();
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen && !isPinned) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPinned]);

  // Sync global stores to local state every 500ms (only when DevTools is open)
  useEffect(() => {
    if (!isOpen) return; // Don't run interval when closed
    
    let lastLogsLength = 0;
    let lastNetworkLength = 0;
    
    const interval = setInterval(() => {
      // Only update if there are new logs/network entries (optimization)
      if (globalLogs.length !== lastLogsLength) {
        setLogs([...globalLogs]);
        lastLogsLength = globalLogs.length;
      }
      
      if (globalNetwork.length !== lastNetworkLength) {
        setNetwork([...globalNetwork]);
        lastNetworkLength = globalNetwork.length;
      }
      
      interface WindowWithDevTools extends Window {
        __devToolsLastStorageUpdate?: number;
        __devToolsLastPerfUpdate?: number;
      }

      interface PerformanceWithMemory extends Performance {
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      }

      // Update storage (throttled - only every 2 seconds)
      const now = Date.now();
      const win = window as WindowWithDevTools;
      if (!win.__devToolsLastStorageUpdate || now - win.__devToolsLastStorageUpdate > 2000) {
        const storageData: Record<string, unknown> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            try {
              storageData[key] = JSON.parse(localStorage.getItem(key) || '');
            } catch {
              storageData[key] = localStorage.getItem(key);
            }
          }
        }
        setStorage(storageData);
        win.__devToolsLastStorageUpdate = now;
      }
      
      // Update performance metrics (throttled - only every 2 seconds)
      if (!win.__devToolsLastPerfUpdate || now - win.__devToolsLastPerfUpdate > 2000) {
        if (window.performance) {
          const perf = window.performance as PerformanceWithMemory;
          const timing = perf.timing;
          const navigation = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          setPerformance({
            loadTime: timing.loadEventEnd - timing.navigationStart,
            domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
            memory: perf.memory,
            resources: perf.getEntriesByType('resource').length,
            navigation,
          });
          win.__devToolsLastPerfUpdate = now;
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isOpen]);
  
  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && activeTab === 'logs' && logScrollRef.current) {
      const scrollElement = logScrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [logs, autoScroll, activeTab]);

  const clearLogs = () => {
    globalLogs.length = 0;
    setLogs([]);
  };
  
  const clearNetwork = () => {
    globalNetwork.length = 0;
    setNetwork([]);
  };

  const exportLogs = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devtools-logs-${new Date().toISOString()}.json`;
    a.click();
    toast.success('Logs exported successfully');
  };

  const exportNetwork = () => {
    const data = JSON.stringify(network, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devtools-network-${new Date().toISOString()}.json`;
    a.click();
    toast.success('Network data exported successfully');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const clearAll = () => {
    clearLogs();
    clearNetwork();
    toast.success('All data cleared');
  };

  const filteredLogs = logs
    .filter(log => typeFilter === 'all' || log.type === typeFilter)
    .filter(log => log.message.toLowerCase().includes(filter.toLowerCase()));

  const errorCount = logs.filter(l => l.type === 'error').length;
  const warnCount = logs.filter(l => l.type === 'warn').length;

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-muted-foreground';
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 400 && status < 500) return 'text-yellow-500';
    if (status >= 500) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'warn': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'info': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground border-muted';
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        variant="outline"
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform"
        title="DevTools (⌘⇧D)"
      >
        <Bug className="h-5 w-5" />
        {(errorCount > 0 || warnCount > 0) && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-red-500 animate-pulse">
            {errorCount + warnCount}
          </Badge>
        )}
      </Button>
    );
  }

  const sizeClass = isMaximized 
    ? "inset-4" 
    : "inset-x-2 sm:inset-x-4 bottom-4 md:right-4 md:left-auto md:w-[800px] max-w-[calc(100vw-1rem)]";
  const heightClass = isMaximized ? "h-[calc(100vh-2rem)]" : "h-[700px] md:h-[600px] min-h-[400px]";

  return (
    <>
      <div className={`fixed ${sizeClass} z-50`}>
        <Card className={`${heightClass} flex flex-col shadow-2xl border-2 bg-background/95 backdrop-blur overflow-hidden`}>
          <div className="flex items-center justify-between p-4 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <Bug className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">DevTools</h3>
              {errorCount > 0 && (
                <Badge variant="destructive" className="rounded-full animate-pulse">
                  {errorCount}
                </Badge>
              )}
              {warnCount > 0 && (
                <Badge variant="outline" className="rounded-full bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  {warnCount}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                ⌘⇧D
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                onClick={clearAll} 
                size="icon" 
                variant="ghost"
                title="Clear all (⌘K)"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button 
                onClick={() => setIsPinned(!isPinned)} 
                size="icon" 
                variant={isPinned ? "default" : "ghost"}
                title="Pin (prevents ESC close)"
              >
                <Pin className="h-4 w-4" />
              </Button>
              <Button 
                onClick={() => setIsMaximized(!isMaximized)} 
                size="icon" 
                variant="ghost"
                title="Toggle size"
              >
                {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button 
                onClick={() => setIsOpen(false)} 
                size="icon" 
                variant="ghost"
                title="Close (ESC)"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TabsList className="mx-4 mt-2 flex-shrink-0 flex-wrap">
            <TabsTrigger value="logs" className="flex items-center gap-2 text-xs sm:text-sm">
              <Terminal className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Console</span>
              <Badge variant="secondary" className="ml-1 text-xs">{logs.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="network" className="flex items-center gap-2 text-xs sm:text-sm">
              <Network className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Network</span>
              <Badge variant="secondary" className="ml-1 text-xs">{network.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="storage" className="flex items-center gap-2 text-xs sm:text-sm">
              <Database className="h-3 w-3 sm:h-4 sm:w-4" />
              Storage
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2 text-xs sm:text-sm">
              <Gauge className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="bugs" className="flex items-center gap-2 text-xs sm:text-sm">
              <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Bug Scanner</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="flex-1 flex flex-col p-2 sm:p-4 pt-2 space-y-2 min-h-0 overflow-hidden">
            <div className="flex gap-2 flex-wrap flex-shrink-0">
              <Input
                placeholder="Filter logs..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="flex-1 min-w-[150px] sm:min-w-[200px] text-sm"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover z-50">
                  <DropdownMenuItem onClick={() => setTypeFilter('all')}>
                    {typeFilter === 'all' && <Check className="mr-2 h-4 w-4" />}
                    All
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter('log')}>
                    {typeFilter === 'log' && <Check className="mr-2 h-4 w-4" />}
                    Log
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter('info')}>
                    {typeFilter === 'info' && <Check className="mr-2 h-4 w-4" />}
                    Info
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter('warn')}>
                    {typeFilter === 'warn' && <Check className="mr-2 h-4 w-4" />}
                    Warn
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTypeFilter('error')}>
                    {typeFilter === 'error' && <Check className="mr-2 h-4 w-4" />}
                    Error
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                onClick={() => setAutoScroll(!autoScroll)} 
                size="icon" 
                variant={autoScroll ? "default" : "outline"}
                title={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button onClick={clearLogs} size="icon" variant="outline" title="Clear logs">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button onClick={exportLogs} size="icon" variant="outline" title="Export logs">
                <Download className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 min-h-0 rounded-md border bg-background overflow-hidden">
              <ScrollArea className="h-full w-full" ref={logScrollRef}>
                <div className="space-y-2 p-2 sm:p-3">
                  {filteredLogs.length === 0 ? (
                    <div className="text-muted-foreground text-center py-8 text-sm">No logs to display</div>
                  ) : (
                    filteredLogs.map((log) => (
                      <div key={log.id} className={`p-2 sm:p-3 rounded-lg border ${getTypeColor(log.type)} group relative hover:shadow-sm transition-shadow`}>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          onClick={() => copyToClipboard(log.message)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <div className="flex items-start gap-2 sm:gap-3 pr-8 sm:pr-10 flex-wrap sm:flex-nowrap">
                          <Badge variant="outline" className="shrink-0 mt-0.5 text-xs">
                            {log.type}
                          </Badge>
                          <span className="text-muted-foreground shrink-0 text-xs mt-1 whitespace-nowrap">
                            {log.timestamp.toLocaleTimeString()}
                          </span>
                          <pre className="flex-1 whitespace-pre-wrap break-words text-xs sm:text-sm leading-relaxed min-w-0 overflow-wrap-anywhere">
                            {log.message}
                          </pre>
                        </div>
                        {log.stack && log.type === 'error' && (
                          <details className="mt-3 text-xs">
                            <summary className="cursor-pointer hover:text-primary transition-colors font-medium">
                              View stack trace
                            </summary>
                          <pre className="mt-2 p-2 sm:p-3 bg-muted/50 rounded-md overflow-auto max-h-48 text-xs whitespace-pre-wrap break-words">
                            {log.stack}
                          </pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="network" className="flex-1 flex flex-col p-2 sm:p-4 pt-2 space-y-2 min-h-0 overflow-hidden">
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <Button onClick={clearNetwork} size="sm" variant="outline" className="text-xs sm:text-sm">
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Clear
              </Button>
              <Button onClick={exportNetwork} size="sm" variant="outline" className="text-xs sm:text-sm">
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Export
              </Button>
            </div>

            <div className="flex-1 min-h-0 rounded-md border bg-background overflow-hidden">
              <ScrollArea className="h-full w-full" ref={networkScrollRef}>
                <div className="space-y-2 p-2 sm:p-3">
                  {network.length === 0 ? (
                    <div className="text-muted-foreground text-center py-8 text-sm">No network requests</div>
                  ) : (
                    network.slice().reverse().map((req) => (
                      <div 
                        key={req.id} 
                        className="p-2 sm:p-3 rounded-lg border bg-card hover:bg-accent/50 group relative cursor-pointer transition-all hover:shadow-sm"
                        onClick={() => setSelectedNetwork(req)}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(req.url);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <div className="flex items-center gap-2 flex-wrap pr-8 sm:pr-10">
                          <Badge variant="outline" className="shrink-0 font-semibold text-xs">
                            {req.method}
                          </Badge>
                          {req.status && (
                            <span className={`shrink-0 font-bold text-xs sm:text-sm ${getStatusColor(req.status)}`}>
                              {req.status}
                            </span>
                          )}
                          {req.error && (
                            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 shrink-0" />
                          )}
                          <span className={`text-xs shrink-0 font-semibold whitespace-nowrap ${
                            req.duration && req.duration < 100 ? 'text-green-500' :
                            req.duration && req.duration < 500 ? 'text-yellow-500' :
                            'text-red-500'
                          }`}>
                            {req.duration}ms
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                            {req.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="mt-2 text-xs break-words font-medium min-w-0 overflow-wrap-anywhere">
                          {req.url}
                        </div>
                        {req.error && (
                          <div className="mt-2 text-xs text-red-500 font-semibold break-words">
                            Error: {req.error}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="storage" className="flex-1 flex flex-col p-2 sm:p-4 pt-2 space-y-2 min-h-0 overflow-hidden">
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <Button 
                onClick={() => {
                  localStorage.clear();
                  toast.success('Local storage cleared');
                }} 
                size="sm" 
                variant="outline"
                className="text-xs sm:text-sm"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Clear Storage
              </Button>
            </div>

            <div className="flex-1 min-h-0 rounded-md border bg-background overflow-hidden">
              <ScrollArea className="h-full w-full">
                <div className="space-y-3 p-2 sm:p-3">
                  {Object.keys(storage).length === 0 ? (
                    <div className="text-muted-foreground text-center py-8 text-sm">No storage items</div>
                  ) : (
                    Object.entries(storage).map(([key, value]) => (
                      <div key={key} className="p-2 sm:p-3 rounded-lg border bg-card group relative hover:shadow-sm transition-shadow">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          onClick={() => copyToClipboard(JSON.stringify(value, null, 2))}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <div className="font-semibold text-primary mb-2 pr-8 sm:pr-10 text-xs sm:text-sm break-words">{key}</div>
                        <pre className="text-xs whitespace-pre-wrap break-words text-muted-foreground leading-relaxed overflow-wrap-anywhere">
                          {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="flex-1 flex flex-col p-2 sm:p-4 pt-2 space-y-2 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 rounded-md border bg-background overflow-hidden">
              <ScrollArea className="h-full w-full">
              <div className="space-y-4 p-2 sm:p-4">
                {performance ? (
                  <>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Gauge className="h-4 w-4" />
                        Page Load Metrics
                      </h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Load Time:</span>
                          <span className="font-mono font-semibold">{performance.loadTime}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">DOM Ready:</span>
                          <span className="font-mono font-semibold">{performance.domReady}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Resources Loaded:</span>
                          <span className="font-mono">{performance.resources}</span>
                        </div>
                      </div>
                    </div>

                    {performance.memory && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Memory Usage
                        </h4>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">JS Heap Used:</span>
                            <span className="font-mono font-semibold">
                              {(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total JS Heap:</span>
                            <span className="font-mono">
                              {(performance.memory.totalJSHeapSize / 1048576).toFixed(2)} MB
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Heap Limit:</span>
                            <span className="font-mono">
                              {(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB
                            </span>
                          </div>
                          <div className="mt-2 pt-2 border-t">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Usage:</span>
                              <span className="font-mono font-semibold">
                                {((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Terminal className="h-4 w-4" />
                        DevTools Stats
                      </h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Console Logs:</span>
                          <span className="font-mono">{logs.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Network Requests:</span>
                          <span className="font-mono">{network.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Storage Items:</span>
                          <span className="font-mono">{Object.keys(storage).length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Errors:</span>
                          <span className="font-mono text-red-500 font-bold">{errorCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Warnings:</span>
                          <span className="font-mono text-yellow-500 font-bold">{warnCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Keyboard Shortcuts</h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Toggle DevTools:</span>
                          <kbd className="px-2 py-1 bg-muted rounded border">⌘⇧D</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Clear Logs:</span>
                          <kbd className="px-2 py-1 bg-muted rounded border">⌘K</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Close:</span>
                          <kbd className="px-2 py-1 bg-muted rounded border">ESC</kbd>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground text-center py-8">
                    Performance data not available
                  </div>
                )}
              </div>
            </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="bugs" className="flex-1 flex flex-col p-2 sm:p-4 pt-2 space-y-2 min-h-0 overflow-hidden">
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <Button 
                onClick={() => {
                  const scan = bugFinder.scanBugs();
                  toast.success(`Found ${scan.totalBugs} bugs. Check Bug Scanner in admin panel.`);
                }}
                size="sm" 
                variant="outline"
                className="text-xs sm:text-sm"
              >
                <Zap className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Scan Now
              </Button>
              <Button
                onClick={() => {
                  const issues = bugFinder.checkCommonIssues();
                  if (issues.issues.length > 0) {
                    toast.warning(`Found ${issues.issues.length} issues`, {
                      description: issues.recommendations[0],
                    });
                  } else {
                    toast.success('No issues detected');
                  }
                }}
                size="sm"
                variant="outline"
                className="text-xs sm:text-sm"
              >
                <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Check Issues
              </Button>
              <Button
                onClick={() => {
                  const stats = bugFinder.getAPIErrorStats();
                  const edgeStats = bugFinder.getEdgeFunctionErrorStats();
                  const total = Object.keys(stats).length + Object.keys(edgeStats).length;
                  toast.info(`API Errors: ${Object.keys(stats).length}, Edge Functions: ${Object.keys(edgeStats).length}`);
                }}
                size="sm"
                variant="outline"
                className="text-xs sm:text-sm"
              >
                <Network className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Stats
              </Button>
            </div>

            <div className="flex-1 min-h-0 rounded-md border bg-background overflow-hidden">
              <ScrollArea className="h-full w-full">
                <div className="p-2 sm:p-3 space-y-3">
                  {(() => {
                    const scan = bugFinder.scanBugs();
                    return (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <Card className="p-3">
                            <div className="text-lg sm:text-2xl font-bold text-red-600">{scan.critical}</div>
                            <div className="text-xs text-muted-foreground">Critical</div>
                          </Card>
                          <Card className="p-3">
                            <div className="text-lg sm:text-2xl font-bold text-orange-600">{scan.high}</div>
                            <div className="text-xs text-muted-foreground">High</div>
                          </Card>
                          <Card className="p-3">
                            <div className="text-lg sm:text-2xl font-bold text-yellow-600">{scan.medium}</div>
                            <div className="text-xs text-muted-foreground">Medium</div>
                          </Card>
                          <Card className="p-3">
                            <div className="text-lg sm:text-2xl font-bold">{scan.totalBugs}</div>
                            <div className="text-xs text-muted-foreground">Total</div>
                          </Card>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">Error Breakdown</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">API:</span>
                              <span className="font-bold">{scan.summary.apiErrors}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">404:</span>
                              <span className="font-bold">{scan.summary.notFoundErrors}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Fetch:</span>
                              <span className="font-bold">{scan.summary.fetchErrors}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Edge:</span>
                              <span className="font-bold">{scan.summary.edgeErrors}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Realtime:</span>
                              <span className="font-bold">{scan.summary.realtimeErrors}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Promise:</span>
                              <span className="font-bold">{scan.summary.promiseRejections}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Runtime:</span>
                              <span className="font-bold">{scan.summary.runtimeErrors}</span>
                            </div>
                          </div>
                        </div>

                        {(() => {
                          const issues = bugFinder.checkCommonIssues();
                          if (issues.issues.length > 0) {
                            return (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-orange-600">⚠️ Detected Issues</h4>
                                <div className="space-y-1 text-xs">
                                  {issues.issues.map((issue, i) => (
                                    <div key={i} className="p-2 bg-orange-500/10 border border-orange-500/20 rounded">
                                      <div className="font-semibold text-orange-600">{issue.severity.toUpperCase()}</div>
                                      <div className="text-muted-foreground">{issue.message}</div>
                                    </div>
                                  ))}
                                </div>
                                {issues.recommendations.length > 0 && (
                                  <div className="mt-2">
                                    <h5 className="font-semibold text-xs mb-1">Recommendations:</h5>
                                    <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                                      {issues.recommendations.map((rec, i) => (
                                        <li key={i}>{rec}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                              ✅ No issues detected
                            </div>
                          );
                        })()}

                        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                          For detailed bug reports, use the Bug Scanner in the admin panel
                        </div>
                      </>
                    );
                  })()}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
        </Card>
      </div>

      {/* Network Request Details Dialog */}
      <Dialog open={!!selectedNetwork} onOpenChange={() => setSelectedNetwork(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Network Request Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedNetwork && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">General</h4>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-24">Method:</span>
                      <Badge variant="outline">{selectedNetwork.method}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-24">Status:</span>
                      <span className={getStatusColor(selectedNetwork.status)}>
                        {selectedNetwork.status || 'N/A'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-24">Duration:</span>
                      <span>{selectedNetwork.duration}ms</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-24">Time:</span>
                      <span>{selectedNetwork.timestamp.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm mb-2">URL</h4>
                  <div className="p-2 bg-muted rounded text-xs font-mono break-all">
                    {selectedNetwork.url}
                  </div>
                </div>

                {selectedNetwork.requestBody && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Request Body</h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(
                          typeof selectedNetwork.requestBody === 'string' 
                            ? selectedNetwork.requestBody 
                            : JSON.stringify(selectedNetwork.requestBody, null, 2)
                        )}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="p-3 bg-muted rounded text-xs font-mono overflow-auto max-h-48">
                      {typeof selectedNetwork.requestBody === 'string'
                        ? selectedNetwork.requestBody
                        : JSON.stringify(selectedNetwork.requestBody, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedNetwork.responseBody && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Response Body</h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(
                          typeof selectedNetwork.responseBody === 'string'
                            ? selectedNetwork.responseBody
                            : JSON.stringify(selectedNetwork.responseBody, null, 2)
                        )}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="p-3 bg-muted rounded text-xs font-mono overflow-auto max-h-64">
                      {typeof selectedNetwork.responseBody === 'string'
                        ? selectedNetwork.responseBody
                        : JSON.stringify(selectedNetwork.responseBody, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedNetwork.error && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2 text-red-500">Error</h4>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-xs font-mono">
                      {selectedNetwork.error}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
