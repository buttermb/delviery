/**
 * Admin Debug Panel - Visual debug console for real-time log monitoring
 * 
 * Features:
 * - Floating button with log count badge
 * - Category filter dropdown
 * - Export logs functionality
 * - User info display
 * - Color-coded log entries
 * - Auto-refresh every 2 seconds
 * - Only visible to admins or in development
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { debugLogger, LogEntry, LogCategory } from '@/lib/debug/logger';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Bug, Download, Trash2, AlertCircle, Info, AlertTriangle, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSmartDate } from '@/lib/formatters';

const CATEGORIES: Array<LogCategory | 'all'> = [
  'all',
  'AUTH',
  'ORDER_CREATE',
  'ORDER_QUERY',
  'REALTIME',
  'DB_QUERY',
  'RLS_FAILURE',
  'STATE_CHANGE'
];

const levelColors: Record<string, string> = {
  info: 'bg-blue-900/50 border-blue-700',
  warn: 'bg-yellow-900/50 border-yellow-700',
  error: 'bg-red-900/50 border-red-700',
  debug: 'bg-gray-800 border-gray-700'
};

const levelIcons: Record<string, React.ReactNode> = {
  info: <Info className="h-3 w-3 text-blue-400" />,
  warn: <AlertTriangle className="h-3 w-3 text-yellow-400" />,
  error: <AlertCircle className="h-3 w-3 text-red-400" />,
  debug: <Search className="h-3 w-3 text-gray-400" />
};

/**
 * Check if current route is a tenant admin route (e.g., /tenant-slug/admin/...)
 */
function isTenantAdminRoute(pathname: string): boolean {
  return /^\/[^/]+\/admin(\/|$)/.test(pathname);
}

/**
 * Simplified debug panel for non-admin routes (dev mode only)
 * Does not use useTenantAdminAuth to avoid context errors
 */
function SimplifiedDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogCategory | 'all'>('all');

  // Only poll for logs when the panel is open to avoid wasting CPU cycles
  useEffect(() => {
    if (!isOpen) return;
    const updateLogs = () => {
      setLogs([...debugLogger.getLogs()]);
    };
    updateLogs();
    const interval = setInterval(updateLogs, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.category === filter);

  const handleClear = useCallback(() => {
    debugLogger.clearLogs();
    setLogs([]);
  }, []);

  const handleExport = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      logs: debugLogger.getLogs(),
      storedErrors: debugLogger.getStoredErrors(),
      userInfo: { note: 'Not on admin route' }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-max">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant={errorCount > 0 ? "destructive" : "secondary"}
        size="sm"
        className="relative shadow-lg"
      >
        <Bug className="h-4 w-4 mr-1" />
        Debug
        {logs.length > 0 && (
          <Badge
            variant={errorCount > 0 ? "destructive" : warnCount > 0 ? "outline" : "secondary"}
            className="ml-2 h-5 min-w-[20px] px-1"
          >
            {logs.length}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div data-dark-panel className="absolute bottom-12 right-0 w-[650px] h-[450px] bg-gray-950 text-white rounded-lg shadow-2xl flex flex-col border border-gray-800 overflow-hidden">
          <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-900">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Debug Console (Dev Mode)
            </h3>
            <div className="flex gap-2 items-center">
              <Select value={filter} onValueChange={(v) => setFilter(v as LogCategory | 'all')}>
                <SelectTrigger className="w-[140px] h-8 bg-gray-800 border-gray-700 text-xs" aria-label="Filter log category">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat === 'all' ? 'All Logs' : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleClear} variant="ghost" size="sm" className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/30">
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
              <Button onClick={handleExport} variant="ghost" size="sm" className="h-8 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30">
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
              <Button onClick={() => setIsOpen(false)} variant="ghost" size="sm" className="h-11 w-11 p-0" aria-label="Close debug console">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 font-mono text-xs space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-gray-500 text-center py-8">No logs yet.</div>
              ) : (
                [...filteredLogs].reverse().map((log, i) => (
                  <div key={`${log.timestamp}-${i}`} className={cn("p-2 rounded border", levelColors[log.level] || 'bg-gray-800 border-gray-700')}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        {levelIcons[log.level]}
                        <span className="font-bold text-gray-200">[{log.category}]</span>
                      </div>
                      <span className="text-gray-500 text-[10px]">{formatSmartDate(log.timestamp, { includeTime: true })}</span>
                    </div>
                    <div className="text-gray-300 mb-1">{log.message}</div>
                    {log.data && Object.keys(log.data).length > 0 && (
                      <pre className="mt-1 text-gray-400 overflow-x-auto text-[10px] bg-black/30 p-1.5 rounded">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="px-3 py-2 border-t border-gray-800 bg-gray-900/50 text-xs text-gray-500 flex justify-between">
            <span>Showing {filteredLogs.length} of {logs.length} logs</span>
            <span>
              {errorCount > 0 && <span className="text-red-400">{errorCount} errors</span>}
              {errorCount > 0 && warnCount > 0 && ' • '}
              {warnCount > 0 && <span className="text-yellow-400">{warnCount} warnings</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Full admin debug panel with tenant auth context
 */
function FullAdminDebugPanel() {
  const { admin, tenant } = useTenantAdminAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogCategory | 'all'>('all');

  // Only poll for logs when the panel is open to avoid wasting CPU cycles
  useEffect(() => {
    if (!isOpen) return;
    const updateLogs = () => {
      setLogs([...debugLogger.getLogs()]);
    };
    updateLogs();
    const interval = setInterval(updateLogs, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.category === filter);

  const handleClear = useCallback(() => {
    debugLogger.clearLogs();
    setLogs([]);
  }, []);

  const handleExport = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      logs: debugLogger.getLogs(),
      storedErrors: debugLogger.getStoredErrors(),
      userInfo: {
        adminId: admin?.id,
        adminEmail: admin?.email,
        tenantId: tenant?.id,
        tenantName: tenant?.business_name
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [admin, tenant]);

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-max">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant={errorCount > 0 ? "destructive" : "secondary"}
        size="sm"
        className="relative shadow-lg"
      >
        <Bug className="h-4 w-4 mr-1" />
        Debug
        {logs.length > 0 && (
          <Badge
            variant={errorCount > 0 ? "destructive" : warnCount > 0 ? "outline" : "secondary"}
            className="ml-2 h-5 min-w-[20px] px-1"
          >
            {logs.length}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div data-dark-panel className="absolute bottom-12 right-0 w-[650px] h-[550px] bg-gray-950 text-white rounded-lg shadow-2xl flex flex-col border border-gray-800 overflow-hidden">
          <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-900">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Bug className="h-4 w-4" />
              Debug Console
              {errorCount > 0 && (
                <Badge variant="destructive" className="h-5">
                  {errorCount} errors
                </Badge>
              )}
            </h3>
            <div className="flex gap-2 items-center">
              <Select value={filter} onValueChange={(v) => setFilter(v as LogCategory | 'all')}>
                <SelectTrigger className="w-[140px] h-8 bg-gray-800 border-gray-700 text-xs" aria-label="Filter log category">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-xs">
                      {cat === 'all' ? 'All Logs' : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleClear} variant="ghost" size="sm" className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/30">
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
              <Button onClick={handleExport} variant="ghost" size="sm" className="h-8 px-2 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30">
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
              <Button onClick={() => setIsOpen(false)} variant="ghost" size="sm" className="h-11 w-11 p-0" aria-label="Close debug console">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="px-3 py-2 bg-gray-900/50 text-xs border-b border-gray-800 grid grid-cols-2 gap-2">
            <div>
              <span className="text-gray-500">Admin:</span>{' '}
              <span className="text-gray-300">{admin?.email || 'Not logged in'}</span>
            </div>
            <div>
              <span className="text-gray-500">Admin ID:</span>{' '}
              <span className="text-gray-300 font-mono">{admin?.id?.slice(0, 8) || 'N/A'}...</span>
            </div>
            <div>
              <span className="text-gray-500">Tenant:</span>{' '}
              <span className="text-gray-300">{tenant?.business_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Tenant ID:</span>{' '}
              <span className="text-gray-300 font-mono">{tenant?.id?.slice(0, 8) || 'N/A'}...</span>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 font-mono text-xs space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-gray-500 text-center py-8">No logs yet. Actions will appear here.</div>
              ) : (
                [...filteredLogs].reverse().map((log, i) => (
                  <div key={`${log.timestamp}-${i}`} className={cn("p-2 rounded border", levelColors[log.level] || 'bg-gray-800 border-gray-700')}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2">
                        {levelIcons[log.level]}
                        <span className="font-bold text-gray-200">[{log.category}]</span>
                      </div>
                      <span className="text-gray-500 text-[10px]">{formatSmartDate(log.timestamp, { includeTime: true })}</span>
                    </div>
                    <div className="text-gray-300 mb-1">{log.message}</div>
                    {log.data && Object.keys(log.data).length > 0 && (
                      <pre className="mt-1 text-gray-400 overflow-x-auto text-[10px] bg-black/30 p-1.5 rounded">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="px-3 py-2 border-t border-gray-800 bg-gray-900/50 text-xs text-gray-500 flex justify-between">
            <span>Showing {filteredLogs.length} of {logs.length} logs</span>
            <span>
              {errorCount > 0 && <span className="text-red-400">{errorCount} errors</span>}
              {errorCount > 0 && warnCount > 0 && ' • '}
              {warnCount > 0 && <span className="text-yellow-400">{warnCount} warnings</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main export - Routes to appropriate panel based on current route
 */
export function AdminDebugPanel() {
  const location = useLocation();
  const isOnAdminRoute = isTenantAdminRoute(location.pathname);
  const isDev = import.meta.env.DEV;

  // Production: Only show on admin routes
  if (!isDev && !isOnAdminRoute) {
    return null;
  }

  // Hide on shop routes to prevent UI clutter
  if (location.pathname.includes('/shop/')) {
    return null;
  }

  // Dev mode on non-admin routes: Use simplified panel without tenant auth
  if (isDev && !isOnAdminRoute) {
    return <SimplifiedDebugPanel />;
  }

  // Admin routes: Use full panel with tenant auth
  return <FullAdminDebugPanel />;
}
