import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { TicketComments } from "./TicketComments";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface TicketDetailProps {
  ticket: Ticket;
  onBack: () => void;
  onUpdate: () => void;
}

export function TicketDetail({ ticket, onBack, onUpdate }: TicketDetailProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "default";
      case "in_progress":
        return "default";
      case "resolved":
        return "secondary";
      case "closed":
        return "outline";
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
              <CardTitle className="text-xl mb-2">{ticket.subject}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={getPriorityColor(ticket.priority) as "default" | "secondary" | "destructive" | "outline"}>
                  {ticket.priority}
                </Badge>
                <Badge variant={getStatusColor(ticket.status) as "default" | "secondary" | "destructive" | "outline"}>
                  {ticket.status}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Description</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {ticket.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Created</div>
              <div className="text-sm">
                {format(new Date(ticket.created_at), "MMM d, yyyy h:mm a")}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Last Updated</div>
              <div className="text-sm">
                {format(new Date(ticket.updated_at), "MMM d, yyyy h:mm a")}
              </div>
            </div>
          </div>

          <TicketComments ticketId={ticket.id} />
        </CardContent>
      </Card>
    </div>
  );
}

