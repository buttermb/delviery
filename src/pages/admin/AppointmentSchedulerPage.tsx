import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  CalendarX2,
  Clock,
  Plus,
  Settings,
} from "lucide-react";
import { AppointmentCalendar } from "@/components/admin/appointments/AppointmentCalendar";
import { AppointmentList } from "@/components/admin/appointments/AppointmentList";
import { AppointmentForm } from "@/components/admin/appointments/AppointmentForm";
import { AvailabilitySettings } from "@/components/admin/appointments/AvailabilitySettings";
import { queryKeys } from "@/lib/queryKeys";

interface Appointment {
  id: string;
  customer_id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled";
  notes?: string;
}

export default function AppointmentSchedulerPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("calendar");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: appointments, isLoading } = useQuery({
    queryKey: queryKeys.appointments.lists(),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        const { data, error } = await supabase
          .from("appointments")
          .select('id, customer_id, scheduled_at, duration_minutes, appointment_type, status, notes')
          .eq("tenant_id", tenant.id)
          .order("scheduled_at", { ascending: true });

        if (error && error.code !== "42P01") {
          logger.error('Failed to fetch appointments', error, { component: 'AppointmentSchedulerPage' });
          return [];
        }

        return (data ?? []).map((apt) => ({
          ...apt,
          type: apt.appointment_type
        })) as Appointment[];
      } catch {
        return [];
      }
    },
    enabled: !!tenant?.id,
  });

  return (
    <div className="space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-foreground">
            Appointment Scheduling
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage customer appointments, consultations, and deliveries
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsSettingsOpen(true)}
            className="min-h-[44px] touch-manipulation"
          >
            <Settings className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Availability</span>
          </Button>
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation"
            onClick={() => {
              setSelectedDate(null);
              setIsFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="text-sm sm:text-base">New Appointment</span>
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!isLoading && appointments?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarX2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No appointments scheduled</p>
          <p className="text-sm mt-1">Create your first appointment to get started.</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar" className="min-h-[44px] touch-manipulation">
            <Calendar className="h-4 w-4 mr-2" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="list" className="min-h-[44px] touch-manipulation">
            <Clock className="h-4 w-4 mr-2" />
            List View
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <AppointmentCalendar
            appointments={appointments ?? []}
            onDateSelect={(date) => {
              setSelectedDate(date);
              setIsFormOpen(true);
            }}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <AppointmentList
            appointments={appointments ?? []}
            isLoading={isLoading}
            onEdit={(appointment) => {
              setSelectedDate(new Date(appointment.scheduled_at));
              setIsFormOpen(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Appointment Form Dialog */}
      {isFormOpen && (
        <AppointmentForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          selectedDate={selectedDate}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.appointments.lists() });
            setIsFormOpen(false);
            setSelectedDate(null);
          }}
        />
      )}

      {/* Availability Settings Dialog */}
      {isSettingsOpen && (
        <AvailabilitySettings
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
        />
      )}
    </div>
  );
}

