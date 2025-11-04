import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminNavigation } from "@/components/super-admin/SuperAdminNavigation";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, CheckCircle, Play, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Mock security scan data
const mockVulnerabilities = [
  { id: 1, type: 'SQL Injection', severity: 'high', location: '/api/users', status: 'open' },
  { id: 2, type: 'XSS', severity: 'medium', location: '/products/search', status: 'fixed' },
  { id: 3, type: 'CSRF', severity: 'low', location: '/admin/settings', status: 'open' },
  { id: 4, type: 'Broken Auth', severity: 'critical', location: '/api/auth', status: 'open' },
];

const mockComplianceChecks = [
  { name: 'SSL/TLS Encryption', status: 'passed', score: 100 },
  { name: 'Password Policy', status: 'passed', score: 95 },
  { name: 'Data Retention', status: 'warning', score: 75 },
  { name: 'Access Logs', status: 'passed', score: 100 },
  { name: 'API Rate Limiting', status: 'passed', score: 90 },
];

export default function SecurityPage() {
  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-400',
      high: 'bg-[hsl(var(--super-admin-accent))]/20 text-[hsl(var(--super-admin-accent))]',
      medium: 'bg-yellow-500/20 text-yellow-400',
      low: 'bg-blue-500/20 text-blue-400',
    };

    return (
      <Badge className={colors[severity] || 'bg-white/10 text-white'}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    return status === 'passed' ? (
      <Badge className="bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]">
        <CheckCircle className="h-3 w-3 mr-1" />
        Passed
      </Badge>
    ) : (
      <Badge className="bg-yellow-500/20 text-yellow-400">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Warning
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--super-admin-bg))]">
      <header className="border-b border-white/10 bg-[hsl(var(--super-admin-surface))]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">🔒 Security</h1>
            <p className="text-sm text-[hsl(var(--super-admin-text))]/70">Vulnerability scanning & compliance</p>
          </div>
          <SuperAdminNavigation />
        </div>
      </header>

      <div className="container mx-auto p-6 space-y-6">
        {/* Security Score */}
        <Card className="bg-gradient-to-r from-[hsl(var(--super-admin-primary))]/20 to-[hsl(var(--super-admin-secondary))]/20 border-[hsl(var(--super-admin-primary))]/30">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))] flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Security Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-5xl font-bold text-[hsl(var(--super-admin-text))]">82/100</div>
                <p className="text-sm text-[hsl(var(--super-admin-text))]/70 mt-2">Good security posture</p>
              </div>
              <Button className="bg-[hsl(var(--super-admin-primary))] hover:bg-[hsl(var(--super-admin-primary))]/90">
                <Play className="h-4 w-4 mr-2" />
                Run New Scan
              </Button>
            </div>
            <Progress value={82} className="h-2" />
          </CardContent>
        </Card>

        {/* Security Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Critical</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">1</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Needs attention</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">High</CardTitle>
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--super-admin-accent))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">1</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Open issues</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Medium</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">0</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Resolved</p>
            </CardContent>
          </Card>

          <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--super-admin-text))]/90">Low</CardTitle>
              <CheckCircle className="h-4 w-4 text-[hsl(var(--super-admin-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[hsl(var(--super-admin-text))]">1</div>
              <p className="text-xs text-[hsl(var(--super-admin-text))]/60 mt-1">Minor issues</p>
            </CardContent>
          </Card>
        </div>

        {/* Vulnerabilities */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-[hsl(var(--super-admin-text))]">Detected Vulnerabilities</CardTitle>
            <Button variant="outline" className="border-white/10 text-[hsl(var(--super-admin-text))]">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Type</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Severity</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Location</TableHead>
                    <TableHead className="text-[hsl(var(--super-admin-text))]/90">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockVulnerabilities.map((vuln) => (
                    <TableRow key={vuln.id} className="border-white/10">
                      <TableCell className="text-[hsl(var(--super-admin-text))]">{vuln.type}</TableCell>
                      <TableCell>{getSeverityBadge(vuln.severity)}</TableCell>
                      <TableCell className="text-[hsl(var(--super-admin-text))] font-mono text-sm">{vuln.location}</TableCell>
                      <TableCell>
                        <Badge className={vuln.status === 'fixed'
                          ? 'bg-[hsl(var(--super-admin-secondary))]/20 text-[hsl(var(--super-admin-secondary))]'
                          : 'bg-[hsl(var(--super-admin-accent))]/20 text-[hsl(var(--super-admin-accent))]'
                        }>
                          {vuln.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Checks */}
        <Card className="bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-[hsl(var(--super-admin-text))]">Compliance Checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockComplianceChecks.map((check, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[hsl(var(--super-admin-text))]">{check.name}</span>
                    {getStatusBadge(check.status)}
                  </div>
                  <Progress value={check.score} className="h-1" />
                </div>
                <span className="ml-4 text-sm font-medium text-[hsl(var(--super-admin-text))]">{check.score}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
