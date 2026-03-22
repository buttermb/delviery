import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Clock, Edit, Loader2 } from "lucide-react";
import { formatSmartDate } from "@/lib/formatters";

interface Appointment {
  id: string;
  customer_id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: string;
  status: string;
  notes?: string;
}

interface AppointmentListProps {
  appointments: Appointment[];
  isLoading: boolean;
  onEdit: (appointment: Appointment) => void;
  onSendReminder?: (appointment: Appointment) => void;
  isSendingReminder?: boolean;
  sendingReminderId?: string | null;
}

export function AppointmentList({
  appointments,
  isLoading,
  onEdit,
  onSendReminder,
  isSendingReminder = false,
  sendingReminderId = null,
}: AppointmentListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No appointments scheduled.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">
                    {formatSmartDate(apt.scheduled_at)}
                  </div>
                  <Badge variant={apt.status === "confirmed" ? "default" : "secondary"}>
                    {apt.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {apt.type} • {apt.duration_minutes} minutes
                </div>
                {apt.notes && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{apt.notes}</div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {onSendReminder && apt.status !== "cancelled" && apt.status !== "completed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSendReminder(apt)}
                    disabled={isSendingReminder && sendingReminderId === apt.id}
                    className="min-h-[44px] touch-manipulation"
                    title="Send reminder (25 credits)"
                  >
                    {isSendingReminder && sendingReminderId === apt.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(apt)}
                  className="min-h-[44px] touch-manipulation"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

