import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeft, FileText, Users } from "lucide-react";

interface Recall {
  id: string;
  batch_number: string;
  reason: string;
  severity: string;
  status: string;
  affected_customers_count: number;
  created_at: string;
}

interface RecallDetailProps {
  recall: Recall;
  onBack: () => void;
  onUpdate: () => void;
}

export function RecallDetail({ recall, onBack, onUpdate }: RecallDetailProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
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
              <CardTitle className="text-xl mb-2">
                Recall: {recall.batch_number}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={getSeverityColor(recall.severity) as any}>
                  {recall.severity}
                </Badge>
                <Badge variant={recall.status === "active" ? "destructive" : "secondary"}>
                  {recall.status}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Recall Reason</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {recall.reason}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Affected Customers</div>
              <div className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                {recall.affected_customers_count}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Created</div>
              <div className="text-sm">
                {format(new Date(recall.created_at), "MMM d, yyyy h:mm a")}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-2">Actions</h3>
            <div className="flex gap-2">
              <Button variant="outline" className="min-h-[44px] touch-manipulation">
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
              <Button variant="outline" className="min-h-[44px] touch-manipulation">
                <Users className="h-4 w-4 mr-2" />
                Notify Customers
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

