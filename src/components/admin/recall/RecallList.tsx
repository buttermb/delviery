import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Recall {
  id: string;
  batch_number: string;
  reason: string;
  severity: string;
  status: string;
  affected_customers_count: number;
  created_at: string;
}

interface RecallListProps {
  recalls: Recall[];
  isLoading: boolean;
  onSelect: (recall: Recall) => void;
}

export function RecallList({ recalls, isLoading, onSelect }: RecallListProps) {
  const getSeverityColor = (severity: string): "default" | "secondary" | "destructive" | "outline" => {
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

  const getStatusColor = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active":
        return "destructive";
      case "draft":
        return "secondary";
      case "resolved":
        return "default";
      case "closed":
        return "outline";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (recalls.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No recalls found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {recalls.map((recall) => (
            <div
              key={recall.id}
              onClick={() => onSelect(recall)}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-medium truncate">
                    Batch: {recall.batch_number}
                  </div>
                  <Badge variant={getSeverityColor(recall.severity)} className="shrink-0">
                    {recall.severity}
                  </Badge>
                  <Badge variant={getStatusColor(recall.status)} className="shrink-0">
                    {recall.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {recall.reason}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {recall.affected_customers_count} affected customers • Created{" "}
                  {format(new Date(recall.created_at), "MMM d, yyyy")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

