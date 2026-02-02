import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Building2 from "lucide-react/dist/esm/icons/building-2";
import { getStatusColor } from "@/lib/utils/statusColors";

interface Batch {
  id: string;
  batch_number: string;
  product_id: string;
  product?: { name: string };
  test_results?: Record<string, unknown> & { thc?: number; cbd?: number; contaminants?: string };
  lab_name?: string;
  test_date?: string;
  coa_url?: string;
  coa_qr_code_url?: string;
  compliance_status?: string;
}

interface TestResultsViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: Batch;
}

export function TestResultsViewer({ open, onOpenChange, batch }: TestResultsViewerProps) {
  const testResults = batch.test_results || {};

  // Map compliance status to semantic status
  const getComplianceStatus = (status?: string) => {
    switch (status) {
      case 'verified':
        return 'completed';
      case 'failed':
        return 'failed';
      default:
        return 'pending';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Results - {batch.batch_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lab Information */}
          <Card>
            <CardHeader>
              <CardTitle>Lab Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Lab:</span>
                <span>{batch.lab_name || "Not specified"}</span>
              </div>
              {batch.test_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Test Date:</span>
                  <span>{new Date(batch.test_date).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Potency Results */}
          <Card>
            <CardHeader>
              <CardTitle>Potency Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {testResults.thc !== null && testResults.thc !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground">THC</div>
                    <div className="text-2xl font-bold">{testResults.thc}%</div>
                  </div>
                )}
                {testResults.cbd !== null && testResults.cbd !== undefined && (
                  <div>
                    <div className="text-sm text-muted-foreground">CBD</div>
                    <div className="text-2xl font-bold">{testResults.cbd}%</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contaminants */}
          {testResults.contaminants && (
            <Card>
              <CardHeader>
                <CardTitle>Contaminants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-muted rounded-lg">
                  {testResults.contaminants}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Terpenes */}
          {testResults.terpenes && (
            <Card>
              <CardHeader>
                <CardTitle>Terpene Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-muted rounded-lg">
                  {(testResults.terpenes as string) || "N/A"}
                </div>
              </CardContent>
            </Card>
          )}

          {/* COA Document */}
          {batch.coa_url && (
            <Card>
              <CardHeader>
                <CardTitle>Certificate of Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={batch.coa_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    View COA Document
                  </a>
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compliance Status */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                variant="outline"
                className={`border ${getStatusColor(getComplianceStatus(batch.compliance_status))}`}
              >
                {(batch.compliance_status || "pending")
                  .charAt(0)
                  .toUpperCase() +
                  (batch.compliance_status || "pending").slice(1)}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
