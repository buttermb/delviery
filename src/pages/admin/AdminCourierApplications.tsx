import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { safeStatus, safeUpperCase } from "@/utils/stringHelpers";

interface CourierApplication {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  borough: string;
  vehicle_type: string;
  experience: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const AdminCourierApplications = () => {
  const { toast } = useToast();
  const [applications, setApplications] = useState<CourierApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<CourierApplication | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    fetchApplications();

    const setupChannel = async () => {
      channel = supabase
        .channel('admin-courier-apps-updates', {
          config: {
            broadcast: { self: false },
            presence: { key: '' }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'courier_applications'
          },
          (payload) => {
            console.log('Courier application updated:', payload);
            fetchApplications();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to courier applications channel');
          }
        });
    };

    setupChannel();

    return () => {
      if (channel) {
        supabase.removeChannel(channel).then(() => {
          channel = null;
        });
      }
    };
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('courier_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast({
        title: "Error",
        description: "Failed to load courier applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (applicationId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('courier_applications')
        .update({
          status: newStatus,
          admin_notes: adminNotes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (error) throw error;

      toast({
        title: "✓ Application Updated",
        description: `Application has been ${newStatus}`,
      });

      setSelectedApp(null);
      setAdminNotes("");
      await fetchApplications();
    } catch (error: any) {
      console.error('Error updating application:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update application",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "default",
      approved: "secondary",
      denied: "destructive",
      needs_info: "outline",
    };

    const safeStatusValue = safeStatus(status);
    return (
      <Badge variant={variants[safeStatusValue] || "default"}>
        {safeUpperCase(safeStatusValue)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Courier Applications</CardTitle>
          <CardDescription>
            Review and manage courier applications for New York Minute
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Borough</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No applications found
                  </TableCell>
                </TableRow>
              ) : (
                applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.full_name}</TableCell>
                    <TableCell>{app.email}</TableCell>
                    <TableCell>{app.phone}</TableCell>
                    <TableCell>{app.borough}</TableCell>
                    <TableCell>{app.vehicle_type}</TableCell>
                    <TableCell>{getStatusBadge(app.status)}</TableCell>
                    <TableCell>
                      {format(new Date(app.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedApp(app);
                          setAdminNotes(app.admin_notes || "");
                        }}
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Application</DialogTitle>
            <DialogDescription>
              Review applicant details and make a decision
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold">Full Name</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedApp.full_name}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Email</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedApp.email}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Phone</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedApp.phone}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Borough</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedApp.borough}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Vehicle Type</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedApp.vehicle_type}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedApp.status)}</div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Experience</Label>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                  {selectedApp.experience}
                </p>
              </div>

              <div>
                <Label className="text-sm font-semibold">Applied Date</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(selectedApp.created_at), 'PPpp')}
                </p>
              </div>

              {selectedApp.reviewed_at && (
                <div>
                  <Label className="text-sm font-semibold">Reviewed Date</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(selectedApp.reviewed_at), 'PPpp')}
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="admin-notes">Admin Notes</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add notes about this application..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>

              {selectedApp.status === 'pending' && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleStatusUpdate(selectedApp.id, 'approved')}
                    className="flex-1"
                    disabled={actionLoading}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate(selectedApp.id, 'needs_info')}
                    variant="outline"
                    className="flex-1"
                    disabled={actionLoading}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Request More Info
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate(selectedApp.id, 'denied')}
                    variant="destructive"
                    className="flex-1"
                    disabled={actionLoading}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Deny
                  </Button>
                </div>
              )}

              {selectedApp.status !== 'pending' && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleStatusUpdate(selectedApp.id, 'pending')}
                    variant="outline"
                    className="flex-1"
                    disabled={actionLoading}
                  >
                    Reset to Pending
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCourierApplications;
