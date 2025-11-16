import { useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Database, Play, Download, History, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { formatSmartDate } from '@/lib/utils/formatDate';

// Store recent queries in localStorage
const getRecentQueries = (): Array<{ query: string; timestamp: string }> => {
  try {
    const stored = localStorage.getItem('data_explorer_recent_queries');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecentQuery = (query: string) => {
  try {
    const recent = getRecentQueries();
    const updated = [
      { query, timestamp: new Date().toISOString() },
      ...recent.filter((q) => q.query !== query).slice(0, 9), // Keep last 10
    ];
    localStorage.setItem('data_explorer_recent_queries', JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
};

export default function DataExplorerPage() {
  const [query, setQuery] = useState("SELECT * FROM tenants LIMIT 10");
  const [queryToRun, setQueryToRun] = useState<string | null>(null);
  const [recentQueries, setRecentQueries] = useState(getRecentQueries());

  // Execute query via Supabase RPC (safe read-only queries)
  const { data: results, isLoading, error } = useQuery({
    queryKey: ['data-explorer-query', queryToRun],
    queryFn: async () => {
      if (!queryToRun) return [];

      // Only allow SELECT queries for security
      const trimmedQuery = queryToRun.trim().toUpperCase();
      if (!trimmedQuery.startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed');
      }

      // Use Supabase's query method (limited to safe operations)
      // Note: This is a simplified approach. In production, you'd want
      // a proper query builder or whitelisted queries
      try {
        // For now, we'll fetch from common tables
        if (trimmedQuery.includes('FROM tenants')) {
          const { data, error } = await supabase
            .from('tenants')
            .select('id, business_name, subscription_status, subscription_plan, mrr, created_at')
            .limit(100);
          
          if (error) throw error;
          return data || [];
        }

        // Add more table handlers as needed
        throw new Error('Query not supported. Please use: SELECT * FROM tenants LIMIT 10');
      } catch (err) {
        logger.error('Query execution failed', err);
        throw err;
      }
    },
    enabled: !!queryToRun,
  });

  const handleRunQuery = () => {
    if (!query.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a query',
      });
      return;
    }

    setQueryToRun(query);
    saveRecentQuery(query);
    setRecentQueries(getRecentQueries());
  };

  const handleExportResults = () => {
    if (!results || results.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No results to export',
      });
      return;
    }

    try {
      const headers = Object.keys(results[0]);
      const rows = results.map((row) => headers.map((header) => row[header as keyof typeof row] || ''));
      const csv = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `query-results-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Results exported successfully',
      });
    } catch (error) {
      logger.error('Export failed', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to export results',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🔍 Data Explorer</h1>
        <p className="text-sm text-muted-foreground">Query and explore database</p>
      </div>
        {/* SQL Query Builder */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))] flex items-center gap-2">
              <Database className="h-5 w-5" />
              SQL Query Editor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="font-mono text-sm bg-black/20 border-white/10 text-[hsl(var(--super-admin-text))] min-h-[150px]"
              placeholder="Enter your SQL query..."
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleRunQuery}
                disabled={isLoading}
                className="bg-[hsl(var(--super-admin-primary))] hover:bg-[hsl(var(--super-admin-primary))]/90"
              >
                <Play className="h-4 w-4 mr-2" />
                {isLoading ? 'Running...' : 'Run Query'}
              </Button>
              <Button 
                variant="outline" 
                className="border-white/10 text-[hsl(var(--super-admin-text))]"
                onClick={handleExportResults}
                disabled={!results || results.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Results
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Query Results */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">
              Results {results ? `(${results.length} rows)` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <div className="font-semibold">Query Error</div>
                  <div className="text-sm">{error instanceof Error ? error.message : 'Unknown error'}</div>
                </div>
              </div>
            ) : isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Running query...</div>
            ) : !results || results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No results. Run a query to see results here.
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      {Object.keys(results[0]).map((key) => (
                        <TableHead key={key} className="text-[hsl(var(--super-admin-text))]/90">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((row, idx) => (
                      <TableRow key={idx} className="border-white/10">
                        {Object.entries(row).map(([key, value]) => (
                          <TableCell key={key} className="text-[hsl(var(--super-admin-text))]">
                            {value === null || value === undefined
                              ? 'N/A'
                              : typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Queries */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))] flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Queries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentQueries.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">No recent queries</div>
            ) : (
              recentQueries.map((item, index) => (
                <div 
                  key={index} 
                  className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                  onClick={() => setQuery(item.query)}
                >
                  <div className="flex items-start justify-between">
                    <code className="text-xs text-[hsl(var(--super-admin-text))]/80 font-mono flex-1">
                      {item.query}
                    </code>
                    <span className="text-xs text-[hsl(var(--super-admin-text))]/50 ml-4">
                      {item.timestamp ? formatSmartDate(item.timestamp) : 'Unknown'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
    </div>
  );
}
