import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminNavigation } from "@/components/super-admin/SuperAdminNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Flag, Plus, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Mock feature flags data
const mockFeatureFlags = [
  { id: 1, name: 'new_checkout_flow', description: 'Enable new optimized checkout', enabled: true, tenants: 15 },
  { id: 2, name: 'beta_analytics', description: 'Beta analytics dashboard', enabled: false, tenants: 3 },
  { id: 3, name: 'advanced_search', description: 'Advanced product search', enabled: true, tenants: 28 },
  { id: 4, name: 'dark_mode', description: 'Dark mode support', enabled: true, tenants: 45 },
  { id: 5, name: 'ai_recommendations', description: 'AI-powered recommendations', enabled: false, tenants: 0 },
];

export default function FeatureFlagsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [flags, setFlags] = useState(mockFeatureFlags);

  const filteredFlags = flags.filter(flag =>
    flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    flag.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFlag = (id: number) => {
    setFlags(flags.map(flag =>
      flag.id === id ? { ...flag, enabled: !flag.enabled } : flag
    ));
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--super-admin-bg))]">
      <header className="border-b border-white/10 bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">🚩 Feature Flags</h1>
            <p className="text-sm text-[hsl(var(--super-admin-text))]/70">Control feature rollout & experimentation</p>
          </div>
          <SuperAdminNavigation />
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Total Flags</CardTitle>
              <Flag className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">{flags.length}</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Active features</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Enabled</CardTitle>
              <Flag className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {flags.filter(f => f.enabled).length}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Currently active</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Disabled</CardTitle>
              <Flag className="h-4 w-4 text-[hsl(var(--super-admin-accent))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {flags.filter(f => !f.enabled).length}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Not in use</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Tenants</CardTitle>
              <Flag className="h-4 w-4 text-[hsl(var(--super-admin-primary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">
                {flags.reduce((sum, f) => sum + f.tenants, 0)}
              </div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Using features</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--super-admin-text))]/50" />
                <Input
                  placeholder="Search feature flags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-black/20 border-white/10 text-[hsl(var(--super-admin-text))]"
                />
              </div>
              <Button className="bg-[hsl(var(--super-admin-primary))] hover:bg-[hsl(var(--super-admin-primary))]/90">
                <Plus className="h-4 w-4 mr-2" />
                New Flag
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Feature Flags Table */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">
              Feature Flags ({filteredFlags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Flag Name</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Description</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Tenants</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Status</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Toggle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFlags.map((flag) => (
                    <TableRow key={flag.id} className="border-white/10">
                      <TableCell className="text-[hsl(var(--super-admin-text))] font-mono text-sm">{flag.name}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]/70">{flag.description}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{flag.tenants}</TableCell>
                      <TableCell>
                        <Badge className={flag.enabled 
                          ? 'bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]'
                          : 'bg-[hsl(var(--super-admin-text-light))]/20 text-[hsl(var(--super-admin-text-light))]'
                        }>
                          {flag.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={() => toggleFlag(flag.id)}
                        />
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
