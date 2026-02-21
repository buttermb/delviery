import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Clock, X, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { showCopyToast, showErrorToast } from '@/utils/toastHelpers';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  token: string;
}

interface PendingInvitationsProps {
  invitations: Invitation[];
  tenantId: string;
  onInvitationsChange: () => void;
}

export function PendingInvitations({ invitations, tenantId, onInvitationsChange }: PendingInvitationsProps) {
  const { toast } = useToast();
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleCancelInvitation = async (invitationId: string) => {
    setCancelingId(invitationId);
    try {
      const { data, error } = await supabase.functions.invoke('tenant-invite', {
        body: {
          action: 'cancel_invitation',
          invitationId,
          tenantId,
        }
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to cancel invitation';
        throw new Error(errorMessage);
      }

      toast({
        title: 'Invitation Cancelled',
        description: 'The invitation has been cancelled successfully'
      });

      onInvitationsChange();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel invitation',
        variant: 'destructive'
      });
    } finally {
      setCancelingId(null);
    }
  };

  const handleResendInvitation = async (invitation: Invitation) => {
    setResendingId(invitation.id);
    try {
      // Copy invitation link to clipboard
      const inviteLink = `${window.location.origin}/invite/${invitation.token}`;
      await navigator.clipboard.writeText(inviteLink);

      showCopyToast('Invitation link');
    } catch {
      showErrorToast('Failed to copy invitation link');
    } finally {
      setResendingId(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-info/10 text-info border-info/20';
      case 'member': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending Invitations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-accent/50"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getRoleBadgeColor(invitation.role)}>
                      {invitation.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Sent {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleResendInvitation(invitation)}
                  disabled={resendingId === invitation.id}
                >
                  {resendingId === invitation.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Copy Link
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCancelInvitation(invitation.id)}
                  disabled={cancelingId === invitation.id}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
