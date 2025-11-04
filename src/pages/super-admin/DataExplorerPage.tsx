import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminNavigation } from "@/components/super-admin/SuperAdminNavigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Database, Play, Download, History } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Mock query results
const mockQueryResults = [
  { id: '1', business_name: 'Acme Corp', subscription_status: 'active', mrr: 299 },
  { id: '2', business_name: 'Tech Startup', subscription_status: 'trial', mrr: 0 },
  { id: '3', business_name: 'Enterprise LLC', subscription_status: 'active', mrr: 999 },
];

const mockRecentQueries = [
  { query: 'SELECT * FROM tenants WHERE subscription_status = \'active\'', timestamp: '2 mins ago' },
  { query: 'SELECT COUNT(*) FROM super_admin_users', timestamp: '15 mins ago' },
  { query: 'SELECT * FROM tenants ORDER BY created_at DESC LIMIT 10', timestamp: '1 hour ago' },
];

export default function DataExplorerPage() {
  const [query, setQuery] = useState("SELECT * FROM tenants LIMIT 10");
  const [results, setResults] = useState(mockQueryResults);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunQuery = () => {
    setIsRunning(true);
    setTimeout(() => {
      setResults(mockQueryResults);
      setIsRunning(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--super-admin-bg))]">
      <header className="border-b border-white/10 bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">🔍 Data Explorer</h1>
            <p className="text-sm text-[hsl(var(--super-admin-text))]/70">Query and explore database</p>
          </div>
          <SuperAdminNavigation />
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
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
                disabled={isRunning}
                className="bg-[hsl(var(--super-admin-primary))] hover:bg-[hsl(var(--super-admin-primary))]/90"
              >
                <Play className="h-4 w-4 mr-2" />
                {isRunning ? 'Running...' : 'Run Query'}
              </Button>
              <Button variant="outline" className="border-white/10 text-[hsl(var(--super-admin-text))]">
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
              Results ({results.length} rows)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">ID</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Business Name</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Status</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">MRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((row) => (
                    <TableRow key={row.id} className="border-white/10">
                      <TableCell className="text-[hsl(var(--super-admin-text))]/70 font-mono text-xs">{row.id}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{row.business_name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          row.subscription_status === 'active' 
                            ? 'bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]'
                            : 'bg-[hsl(var(--super-admin-primary))]/20 text-[hsl(var(--super-admin-primary))]'
                        }`}>
                          {row.subscription_status}
                        </span>
                      </TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">${row.mrr}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
            {mockRecentQueries.map((item, index) => (
              <div key={index} className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-start justify-between">
                  <code className="text-xs text-[hsl(var(--super-admin-text))]/80 font-mono flex-1">
                    {item.query}
                  </code>
                  <span className="text-xs text-[hsl(var(--super-admin-text))]/50 ml-4">
                    {item.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
