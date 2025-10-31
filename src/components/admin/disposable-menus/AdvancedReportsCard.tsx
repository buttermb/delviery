import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  AlertTriangle,
  Shield,
  Eye,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface AdvancedReportsCardProps {
  menuId: string;
  stats: {
    totalViews: number;
    uniqueVisitors: number;
    conversionRate: string;
    securityIncidents: number;
    avgSessionDuration: number;
    peakAccessTime: string;
  };
}

export const AdvancedReportsCard = ({ menuId, stats }: AdvancedReportsCardProps) => {
  const generateReport = (reportType: string) => {
    console.log(`Generating ${reportType} report for menu ${menuId}`);
    // TODO: Implement report generation
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Advanced Reports</h3>
          </div>
          <Badge variant="outline">Last 30 Days</Badge>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-3 w-3" />
              <span>Total Views</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalViews}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Conversion</span>
            </div>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-3 w-3" />
              <span>Security Incidents</span>
            </div>
            <div className="text-2xl font-bold text-destructive">
              {stats.securityIncidents}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>Unique Visitors</span>
            </div>
            <div className="text-2xl font-bold">{stats.uniqueVisitors}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Avg Duration</span>
            </div>
            <div className="text-2xl font-bold">
              {Math.round(stats.avgSessionDuration / 60)}m
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Peak Time</span>
            </div>
            <div className="text-lg font-bold">{stats.peakAccessTime}</div>
          </div>
        </div>

        {/* Report Actions */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => generateReport('access')}
          >
            <span>Access Activity Report</span>
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => generateReport('security')}
          >
            <span>Security Incidents Report</span>
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => generateReport('conversion')}
          >
            <span>Conversion Analysis Report</span>
            <Download className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => generateReport('compliance')}
          >
            <span>Compliance Audit Report</span>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Card className="p-4 bg-muted/50">
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">Report Information:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Reports include all activity since menu creation</li>
            <li>Security incidents are flagged for review</li>
            <li>Export formats: PDF, CSV, JSON</li>
            <li>All reports are encrypted and timestamped</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};
