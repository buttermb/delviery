import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Cpu, HardDrive, Server, TrendingUp, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Mock data for system metrics
const mockMetricsData = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  cpu: 40 + Math.random() * 30,
  memory: 50 + Math.random() * 20,
  requests: 1000 + Math.random() * 500,
  errors: Math.floor(Math.random() * 10),
}));

export default function MonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📊 System Monitoring</h1>
        <p className="text-sm text-muted-foreground">Real-time platform health & metrics</p>
      </div>
        {/* System Health Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">42%</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Normal load</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Memory</CardTitle>
              <HardDrive className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">8.2 GB</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">65% of 12 GB</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Request Rate</CardTitle>
              <Activity className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">1,234</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">req/min</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Uptime</CardTitle>
              <Clock className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">99.98%</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* System Metrics Chart */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">System Metrics (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockMetricsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--super-admin-surface))', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                />
                <Line type="monotone" dataKey="cpu" stroke="hsl(var(--super-admin-primary))" strokeWidth={2} name="CPU %" />
                <Line type="monotone" dataKey="memory" stroke="hsl(var(--super-admin-secondary))" strokeWidth={2} name="Memory %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Uptime Status */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">Service Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: 'API Server', status: 'operational', uptime: '99.99%' },
              { name: 'Database', status: 'operational', uptime: '100%' },
              { name: 'Auth Service', status: 'operational', uptime: '99.95%' },
              { name: 'Storage', status: 'operational', uptime: '99.98%' },
            ].map((service) => (
              <div key={service.name} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div className="flex items-center gap-3">
                  <Server className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
                  <span className="text-[hsl(var(--super-admin-text))]">{service.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[hsl(var(--super-admin-text))]/60">{service.uptime} uptime</span>
                  <span className="px-2 py-1 rounded text-xs bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]">
                    Operational
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
    </div>
  );
}
