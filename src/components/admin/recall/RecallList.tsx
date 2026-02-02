import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Plus from "lucide-react/dist/esm/icons/plus";
import { EnhancedEmptyState } from "@/components/shared/EnhancedEmptyState";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";

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
  onCreate?: () => void;
}

export function RecallList({ recalls, isLoading, onSelect, onCreate }: RecallListProps) {
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
        <CardContent className="p-0">
          <EnhancedLoadingState variant="spinner" message="Loading recalls..." className="py-12" />
        </CardContent>
      </Card>
    );
  }

  if (recalls.length === 0) {
    return (
      <EnhancedEmptyState
        icon={AlertTriangle}
        title="No Recalls Found"
        description="No product recalls found. That's a good thing!"
        primaryAction={onCreate ? {
          label: "Create Recall",
          onClick: onCreate,
          icon: Plus
        } : undefined}
      />
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

