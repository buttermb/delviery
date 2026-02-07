import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeft, Download, FileText, Calendar } from "lucide-react";

interface ComplianceDocument {
  id: string;
  name: string;
  document_type: string;
  file_url: string;
  expiration_date: string | null;
  status: string;
  created_at: string;
}

interface DocumentDetailProps {
  document: ComplianceDocument;
  onBack: () => void;
  onUpdate: () => void;
}

export function DocumentDetail({
  document,
  onBack,
  onUpdate: _onUpdate,
}: DocumentDetailProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "expired":
        return "destructive";
      case "expiring_soon":
        return "default";
      case "active":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={onBack}
        className="min-h-[44px] touch-manipulation"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to List
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl mb-2">{document.name}</CardTitle>
              <div className="flex items-center gap-2">
                  <Badge variant={getStatusColor(document.status) as "default" | "secondary" | "destructive" | "outline"}>
                    {document.status}
                  </Badge>
                <Badge variant="outline" className="capitalize">
                  {document.document_type}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Created</div>
              <div className="text-sm">
                {format(new Date(document.created_at), "MMM d, yyyy")}
              </div>
            </div>
            {document.expiration_date && (
              <div>
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Expiration Date
                </div>
                <div className="text-sm">
                  {format(new Date(document.expiration_date), "MMM d, yyyy")}
                </div>
              </div>
            )}
          </div>

          {document.file_url && (
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => window.open(document.file_url, "_blank")}
                className="min-h-[44px] touch-manipulation"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Document
              </Button>
            </div>
          )}

          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Audit Trail
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Document Uploaded</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(document.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
              {document.status === "expired" && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-1.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Document Expired</p>
                    <p className="text-xs text-muted-foreground">
                      {document.expiration_date && format(new Date(document.expiration_date), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

