import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Download from "lucide-react/dist/esm/icons/download";
import Eye from "lucide-react/dist/esm/icons/eye";

interface CustomReport {
  id: string;
  name: string;
  description: string;
  report_type: string;
  created_at: string;
}

interface ReportListProps {
  reports: CustomReport[];
  isLoading: boolean;
}

export function ReportList({ reports, isLoading }: ReportListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No custom reports found.</p>
          <p className="text-sm mt-2">Create your first custom report to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="text-sm font-medium truncate">{report.name}</div>
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {report.report_type}
                  </Badge>
                </div>
                {report.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {report.description}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  Created {format(new Date(report.created_at), "MMM d, yyyy")}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] touch-manipulation"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] touch-manipulation"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

