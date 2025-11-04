import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminNavigation } from "@/components/super-admin/SuperAdminNavigation";
import { Activity, TrendingUp, Zap, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Mock API usage data
const mockUsageData = Array.from({ length: 7 }, (_, i) => ({
  day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
  requests: 15000 + Math.random() * 5000,
  errors: Math.floor(Math.random() * 100),
}));

const mockEndpoints = [
  { endpoint: '/api/v1/orders', requests: 45230, avgResponse: 124, errors: 12 },
  { endpoint: '/api/v1/products', requests: 32100, avgResponse: 89, errors: 5 },
  { endpoint: '/api/v1/auth/login', requests: 28900, avgResponse: 156, errors: 45 },
  { endpoint: '/api/v1/customers', requests: 19800, avgResponse: 201, errors: 8 },
];

export default function APIUsagePage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--super-admin-bg))]">
      <header className="border-b border-white/10 bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">🔌 API Usage</h1>
            <p className="text-sm text-[hsl(var(--super-admin-text))]/70">Monitor API performance & rate limits</p>
          </div>
          <SuperAdminNavigation />
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* API Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Total Requests</CardTitle>
              <Activity className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">126,030</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Avg Response</CardTitle>
              <Clock className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">142ms</div>
              <p className="text-xs text-green-400 mt-1">↓ 12ms faster</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Error Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-[hsl(var(--super-admin-accent))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">0.06%</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">70 errors</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Rate Limits</CardTitle>
              <Zap className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">1,000</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">per minute</p>
            </CardContent>
          </Card>
        </div>

        {/* Request Chart */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">API Requests (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockUsageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--super-admin-surface))', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="requests" fill="hsl(var(--super-admin-primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Endpoints */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">Top Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Endpoint</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Requests</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Avg Response</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockEndpoints.map((endpoint) => (
                    <TableRow key={endpoint.endpoint} className="border-white/10">
                      <TableCell className="text-[hsl(var(--super-admin-text))] font-mono text-sm">{endpoint.endpoint}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{endpoint.requests.toLocaleString()}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{endpoint.avgResponse}ms</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          endpoint.errors > 20 
                            ? 'bg-[hsl(var(--super-admin-accent))]/20 text-[hsl(var(--super-admin-accent))]'
                            : 'bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]'
                        }`}>
                          {endpoint.errors}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
