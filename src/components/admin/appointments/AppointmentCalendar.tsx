import { Card, CardContent } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay } from "date-fns";
import { Calendar, Loader2 } from "lucide-react";

interface Appointment {
  id: string;
  scheduled_at: string;
  status: string;
  type: string;
}

interface AppointmentCalendarProps {
  appointments: Appointment[];
  onDateSelect: (date: Date) => void;
  isLoading: boolean;
}

export function AppointmentCalendar({
  appointments,
  onDateSelect,
  isLoading,
}: AppointmentCalendarProps) {
  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter((apt) =>
      isSameDay(new Date(apt.scheduled_at), date)
    );
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

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <CalendarComponent
          mode="single"
          onSelect={(date) => {
            if (date) onDateSelect(date);
          }}
          className="rounded-md border"
          modifiers={{
            hasAppointments: (date) => getAppointmentsForDate(date).length > 0,
          }}
          modifiersClassNames={{
            hasAppointments: "bg-success/20 dark:bg-success/10",
          }}
        />
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium">Today's Appointments</h3>
          {getAppointmentsForDate(new Date()).length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments scheduled for today</p>
          ) : (
            <div className="space-y-2">
              {getAppointmentsForDate(new Date()).map((apt) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-2 border rounded-lg"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {format(new Date(apt.scheduled_at), "h:mm a")}
                    </div>
                    <div className="text-xs text-muted-foreground">{apt.type}</div>
                  </div>
                  <Badge variant={apt.status === "confirmed" ? "default" : "secondary"}>
                    {apt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

