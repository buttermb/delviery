import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Download, Search, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LogEntry {
  id: number;
  timestamp: Date;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  args: any[];
}

export default function ConsoleMonitor() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const logIdRef = useRef(0);

  useEffect(() => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    const addLog = (type: LogEntry['type'], args: any[]) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');

      setLogs(prev => [{
        id: logIdRef.current++,
        timestamp: new Date(),
        type,
        message,
        args
      }, ...prev].slice(0, 1000));
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

  const filteredLogs = logs.filter(log => {
    const matchesType = filter === 'all' || log.type === filter;
    const matchesSearch = !search || log.message.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const clearLogs = () => setLogs([]);

  const exportLogs = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTypeBadge = (type: LogEntry['type']) => {
    const variants = {
      log: 'default',
      warn: 'outline',
      error: 'destructive',
      info: 'secondary'
    } as const;

    return (
      <Badge variant={variants[type]} className="mr-2">
        {type.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Console Monitor</CardTitle>
          <CardDescription>
            Real-time console log tracking and filtering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="log">Log</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            <Button variant="destructive" onClick={clearLogs}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>

          <div className="flex gap-4 mb-4 text-sm text-muted-foreground">
            <span>Total: {logs.length}</span>
            <span>Errors: {logs.filter(l => l.type === 'error').length}</span>
            <span>Warnings: {logs.filter(l => l.type === 'warn').length}</span>
            <span>Filtered: {filteredLogs.length}</span>
          </div>

          <div className="border rounded-lg h-[600px] overflow-auto bg-muted/30 font-mono text-sm">
            {filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No logs to display
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {filteredLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-3 rounded bg-background border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      {getTypeBadge(log.type)}
                      <span className="text-xs text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}.{log.timestamp.getMilliseconds()}
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-xs">
                      {log.message}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
