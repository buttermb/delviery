import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MessageSquare, Loader2, AlertCircle } from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

interface TicketListProps {
  tickets: Ticket[];
  isLoading: boolean;
  onSelect: (ticket: Ticket) => void;
}

export function TicketList({ tickets, isLoading, onSelect }: TicketListProps) {
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No tickets found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => onSelect(ticket)}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-sm font-medium truncate">{ticket.subject}</div>
                  <Badge variant={getPriorityColor(ticket.priority) as any} className="shrink-0">
                    {ticket.priority}
                  </Badge>
                  <Badge variant={getStatusColor(ticket.status) as any} className="shrink-0">
                    {ticket.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Created {format(new Date(ticket.created_at), "MMM d, yyyy")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

