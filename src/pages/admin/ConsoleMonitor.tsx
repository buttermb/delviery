import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { logger } from '@/lib/logger';
import { Trash2, Download, Search, Filter, Terminal, Pause, Play } from 'lucide-react';

interface LogEntry {
  id: number;
  timestamp: Date;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
}

type LogFilter = 'all' | 'log' | 'warn' | 'error' | 'info';

const MAX_LOGS = 1000;
const MAX_MESSAGE_LENGTH = 5000;

const TYPE_BADGE_VARIANTS = {
  log: 'default',
  warn: 'outline',
  error: 'destructive',
  info: 'secondary',
} as const;

function formatMilliseconds(ms: number): string {
  return String(ms).padStart(3, '0');
}

function serializeArg(arg: unknown): string {
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

/* eslint-disable no-console */
export function ConsoleMonitor() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>('all');
  const [search, setSearch] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const logIdRef = useRef(0);
  const isPausedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { debouncedValue: debouncedSearch, isPending: isSearchPending } = useDebouncedValue(search, 300);

  // Keep ref in sync so the console interceptors can check pause state
  // without re-attaching on every pause toggle
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    const addLog = (type: LogEntry['type'], args: unknown[]) => {
      if (isPausedRef.current) return;

      const rawMessage = args.map(serializeArg).join(' ');
      const message = rawMessage.length > MAX_MESSAGE_LENGTH
        ? rawMessage.slice(0, MAX_MESSAGE_LENGTH) + '… (truncated)'
        : rawMessage;

      setLogs(prev => [{
        id: logIdRef.current++,
        timestamp: new Date(),
        type,
        message,
      }, ...prev].slice(0, MAX_LOGS));
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

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.info = originalInfo;
    };
  }, []);

  const filteredLogs = useMemo(() =>
    logs.filter(log => {
      const matchesType = filter === 'all' || log.type === filter;
      const matchesSearch = !debouncedSearch || log.message.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchesType && matchesSearch;
    }),
    [logs, filter, debouncedSearch],
  );

  const stats = useMemo(() => ({
    total: logs.length,
    errors: logs.filter(l => l.type === 'error').length,
    warnings: logs.filter(l => l.type === 'warn').length,
    filtered: filteredLogs.length,
  }), [logs, filteredLogs.length]);

  const clearLogs = useCallback(() => setLogs([]), []);

  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const exportLogs = useCallback(() => {
    try {
      const data = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `console-logs-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Failed to export console logs', err);
    }
  }, [filteredLogs]);

  const handleFilterChange = useCallback((value: string) => {
    setFilter(value as LogFilter);
  }, []);

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Console Monitor</CardTitle>
              <CardDescription>
                Real-time console log tracking and filtering
              </CardDescription>
            </div>
            {isPaused && (
              <Badge variant="outline" className="text-amber-600 border-amber-600">
                Paused
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  aria-label="Search logs"
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
                {isSearchPending && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" aria-hidden="true" />
                )}
              </div>
            </div>

            <Select value={filter} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filter by log type">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="log">Log</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={isPaused ? 'default' : 'outline'}
              onClick={togglePause}
              aria-label={isPaused ? 'Resume log capture' : 'Pause log capture'}
            >
              {isPaused ? (
                <><Play className="h-4 w-4 mr-2" />Resume</>
              ) : (
                <><Pause className="h-4 w-4 mr-2" />Pause</>
              )}
            </Button>

            <Button variant="outline" onClick={exportLogs} aria-label="Export logs as JSON">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            <Button variant="destructive" onClick={clearLogs} aria-label="Clear all logs">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>

          <div className="flex gap-4 mb-4 text-sm text-muted-foreground" role="status" aria-live="polite" aria-label="Log statistics">
            <span>Total: {stats.total}</span>
            <span>Errors: {stats.errors}</span>
            <span>Warnings: {stats.warnings}</span>
            <span>Filtered: {stats.filtered}</span>
          </div>

          <ScrollArea className="border rounded-lg h-[600px] bg-muted/30">
            <div ref={scrollRef} className="font-mono text-sm">
              {filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-[580px]">
                  <EnhancedEmptyState
                    icon={Terminal}
                    title="No Logs to Display"
                    description={search || filter !== 'all' ? "No logs match your filters." : "Console logs will appear here in real-time."}
                    compact
                  />
                </div>
              ) : (
                <div className="p-4 space-y-2" role="log" aria-label="Console output">
                  {filteredLogs.map(log => (
                    <div
                      key={log.id}
                      className="p-3 rounded bg-background border border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <Badge variant={TYPE_BADGE_VARIANTS[log.type]} className="mr-2 shrink-0">
                          {log.type.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {log.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.{formatMilliseconds(log.timestamp.getMilliseconds())}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap break-all text-xs mt-1">
                        {log.message}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
