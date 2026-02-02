import { logger } from '@/lib/logger';
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Plus from "lucide-react/dist/esm/icons/plus";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Filter from "lucide-react/dist/esm/icons/filter";
import Search from "lucide-react/dist/esm/icons/search";
import { TicketList } from "@/components/admin/support/TicketList";
import { TicketForm } from "@/components/admin/support/TicketForm";
import { TicketDetail } from "@/components/admin/support/TicketDetail";
import { queryKeys } from "@/lib/queryKeys";
import { Input } from "@/components/ui/input";

interface Ticket {
  id: string;
  customer_id: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
  updated_at: string;
}

export default function SupportTicketsPage() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: tickets, isLoading } = useQuery({
    queryKey: queryKeys.support.tickets(),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        const { data, error } = await supabase
          .from("support_tickets")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false });

        if (error && error.code !== "42P01") {
          logger.error('Failed to fetch tickets', error, { component: 'SupportTicketsPage' });
          return [];
        }

        return (data || []) as any as Ticket[];
      } catch {
        return [];
      }
    },
    enabled: !!tenant?.id,
  });

  const filteredTickets = tickets?.filter((ticket) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "open" && ticket.status === "open") ||
      (activeTab === "in_progress" && ticket.status === "in_progress") ||
      (activeTab === "resolved" && ticket.status === "resolved");
    const matchesSearch =
      !searchTerm ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  }) || [];

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
            🎫 Support Tickets
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage customer support requests and track resolution
          </p>
        </div>
        <Button
          className="bg-emerald-500 hover:bg-emerald-600 min-h-[44px] touch-manipulation"
          onClick={() => {
            setSelectedTicket(null);
            setIsFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="text-sm sm:text-base">New Ticket</span>
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 min-h-[44px] touch-manipulation"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="min-h-[44px] touch-manipulation">
            All
          </TabsTrigger>
          <TabsTrigger value="open" className="min-h-[44px] touch-manipulation">
            Open
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="min-h-[44px] touch-manipulation">
            In Progress
          </TabsTrigger>
          <TabsTrigger value="resolved" className="min-h-[44px] touch-manipulation">
            Resolved
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {selectedTicket ? (
            <TicketDetail
              ticket={selectedTicket}
              onBack={() => setSelectedTicket(null)}
              onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.support.tickets() });
                setSelectedTicket(null);
              }}
            />
          ) : (
            <TicketList
              tickets={filteredTickets}
              isLoading={isLoading}
              onSelect={(ticket) => setSelectedTicket(ticket as any)}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Ticket Form Dialog */}
      {isFormOpen && (
        <TicketForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          ticket={selectedTicket}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.support.tickets() });
            setIsFormOpen(false);
            setSelectedTicket(null);
          }}
        />
      )}
    </div>
  );
}

