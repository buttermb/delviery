import { useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Shield } from "lucide-react";

interface VerificationRequest {
  id: string;
  user_id: string;
  verification_type: string;
  verification_method: string;
  verified: boolean;
  created_at: string;
  id_front_url?: string;
  id_back_url?: string;
  selfie_url?: string;
  user_email?: string;
}

const AdminAgeVerification = () => {
  const { session } = useAdminAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!session) return;
    
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    fetchVerificationRequests();

    const setupChannel = async () => {
      channel = supabase
        .channel('admin-verifications-updates', {
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
            table: 'age_verifications'
          },
          (payload) => {
            console.log('Verification updated:', payload);
            fetchVerificationRequests();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to age verifications channel');
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
  }, [session]);

  const fetchVerificationRequests = async () => {
    try {
      setLoading(true);
      
      // Fetch pending verifications
      const { data: verifications, error } = await supabase
        .from("age_verifications")
        .select("*")
        .eq("verified", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Email requires service role key - showing user_id instead
      const enrichedRequests = verifications?.map((v: any) => {
        return {
          ...v,
          user_email: `User: ${v.user_id.slice(0, 8)}...` // Show partial user_id instead of email
        };
      }) || [];

      setRequests(enrichedRequests);
    } catch (error) {
      console.error("Error fetching verification requests:", error);
      toast.error("Failed to load verification requests");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (verificationId: string, userId: string) => {
    try {
      // Log document access
      await supabase.rpc('log_document_access', {
        _verification_id: verificationId,
        _access_type: 'approve'
      });

      // Update age_verifications
      const { error: verificationError } = await supabase
        .from("age_verifications")
        .update({ verified: true })
        .eq("id", verificationId);

      if (verificationError) throw verificationError;

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          age_verified: true,
          verification_approved_at: new Date().toISOString()
        })
        .eq("user_id", userId);

      if (profileError) throw profileError;

      // Log security event
      await supabase.from("security_events").insert({
        event_type: "age_verification_approved",
        user_id: userId,
        details: { verification_id: verificationId, admin_id: session?.user?.id }
      });

      toast.success("✓ Age verification approved");
      await fetchVerificationRequests();
    } catch (error: any) {
      console.error("Error approving verification:", error);
      toast.error(error.message || "Failed to approve verification");
    }
  };

  const handleReject = async (verificationId: string, userId: string) => {
    const reason = rejectionReason[verificationId];
    if (!reason?.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      // Log document access
      await supabase.rpc('log_document_access', {
        _verification_id: verificationId,
        _access_type: 'reject'
      });

      // Update profile with rejection
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          age_verified: false,
          verification_rejected_at: new Date().toISOString(),
          verification_rejection_reason: reason
        })
        .eq("user_id", userId);

      if (profileError) throw profileError;

      // Mark verification as processed (not verified)
      const { error: verificationError } = await supabase
        .from("age_verifications")
        .update({ verified: false })
        .eq("id", verificationId);

      if (verificationError) throw verificationError;

      // Log security event
      await supabase.from("security_events").insert({
        event_type: "age_verification_rejected",
        user_id: userId,
        details: { 
          verification_id: verificationId, 
          reason, 
          admin_id: session?.user?.id 
        }
      });

      toast.success("✓ Age verification rejected");
      await fetchVerificationRequests();
    } catch (error: any) {
      console.error("Error rejecting verification:", error);
      toast.error(error.message || "Failed to reject verification");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading verification requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold">Age Verification Review</h1>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
            <p className="text-lg text-muted-foreground">
              No pending age verification requests
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {requests.map((request) => (
            <Card key={request.id} className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <span>{request.user_email}</span>
                    <Badge variant="secondary">
                      {request.verification_method.toUpperCase()}
                    </Badge>
                  </CardTitle>
                  <Badge variant="outline">
                    {new Date(request.created_at).toLocaleDateString()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {request.id_front_url && (
                    <div>
                      <p className="text-sm font-medium mb-2">ID Front</p>
                      <img
                        src={request.id_front_url}
                        alt="ID Front"
                        className="w-full rounded border"
                      />
                    </div>
                  )}
                  {request.id_back_url && (
                    <div>
                      <p className="text-sm font-medium mb-2">ID Back</p>
                      <img
                        src={request.id_back_url}
                        alt="ID Back"
                        className="w-full rounded border"
                      />
                    </div>
                  )}
                  {request.selfie_url && (
                    <div>
                      <p className="text-sm font-medium mb-2">Selfie</p>
                      <img
                        src={request.selfie_url}
                        alt="Selfie"
                        className="w-full rounded border"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Textarea
                    placeholder="Rejection reason (required if rejecting)..."
                    value={rejectionReason[request.id] || ""}
                    onChange={(e) =>
                      setRejectionReason({
                        ...rejectionReason,
                        [request.id]: e.target.value,
                      })
                    }
                    className="min-h-[80px]"
                  />

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleApprove(request.id, request.user_id)}
                      className="flex-1"
                      variant="default"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve Verification
                    </Button>
                    <Button
                      onClick={() => handleReject(request.id, request.user_id)}
                      className="flex-1"
                      variant="destructive"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Verification
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAgeVerification;
