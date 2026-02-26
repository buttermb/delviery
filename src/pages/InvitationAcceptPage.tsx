
import { logger } from '@/lib/logger';
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { SEOHead } from '@/components/SEOHead';

interface InvitationDetails {
  email: string;
  role: string;
  tenant: {
    business_name: string;
    slug: string;
  };
}

export default function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthAndValidateInvitation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkAuthAndValidateInvitation is defined below, only run when token changes
  }, [token]);

  const checkAuthAndValidateInvitation = async () => {
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);

      // Validate invitation token via edge function (avoids TypeScript issues with new table)
      const { data, error: inviteError } = await supabase.functions.invoke('tenant-invite', {
        body: {
          action: 'get_invitation_details',
          token
        }
      });

      if (inviteError) {
        setError('This invitation is invalid or has expired');
        return;
      }

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        setError(typeof data.error === 'string' ? data.error : 'This invitation is invalid or has expired');
        return;
      }

      if (!data?.invitation) {
        setError('This invitation is invalid or has expired');
        return;
      }

      setInvitation({
        email: data.invitation.email,
        role: data.invitation.role,
        tenant: {
          business_name: data.invitation.tenant_name,
          slug: data.invitation.tenant_slug
        }
      });

      // Check for email mismatch if authenticated
      if (session?.user?.email && session.user.email.toLowerCase() !== data.invitation.email.toLowerCase()) {
        logger.warn('Invitation email mismatch - logging out current user', {
          current: session.user.email,
          invited: data.invitation.email
        });
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        toast.info("Account Mismatch", {
          description: "You were logged in with a different email. Please log in with the invited email.",
          duration: 6000,
        });
      }
    } catch (err) {
      logger.error('Error validating invitation', err, { component: 'InvitationAcceptPage' });
      setError('Failed to validate invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!token) return;

    setAccepting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Authentication Required', {
          description: 'Please sign in to accept this invitation',
        });
        // Store token for after login
        sessionStorage.setItem('pending_invitation', token);
        navigate(`/signup?email=${encodeURIComponent(invitation?.email ?? '')}`);
        return;
      }

      const { data, error } = await supabase.functions.invoke('tenant-invite', {
        body: {
          action: 'accept_invitation',
          token
        }
      });

      if (error) throw error;

      // Check for error in response body (some edge functions return 200 with error)
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        const errorMessage = typeof data.error === 'string' ? data.error : 'Failed to accept invitation';
        throw new Error(errorMessage);
      }

      toast.success('Success!', {
        description: `You've joined ${invitation?.tenant.business_name}`,
      });

      // Redirect to tenant admin panel
      navigate(`/${invitation?.tenant.slug}/admin`);
    } catch (error: unknown) {
      logger.error('Error accepting invitation', error, { component: 'InvitationAcceptPage' });
      const errorMessage = error instanceof Error ? error.message : 'Failed to accept invitation';
      toast.error('Error', {
        description: errorMessage,
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5">
        <SEOHead
          title="Validating Invitation"
          description="Please wait while we validate your invitation"
        />
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-4">
        <SEOHead
          title="Invalid Invitation"
          description="This invitation is invalid or has expired"
        />
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-center">Invalid Invitation</CardTitle>
            <CardDescription className="text-center">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-4">
      <SEOHead
        title={`Join ${invitation?.tenant.business_name}`}
        description="Accept your team invitation"
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">You've Been Invited!</CardTitle>
          <CardDescription className="text-center text-base">
            Join {invitation?.tenant.business_name} as a team member
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="bg-accent/50 p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Organization</span>
                <span className="font-medium">{invitation?.tenant.business_name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Invited Email</span>
                <span className="font-medium">{invitation?.email}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium capitalize">{invitation?.role}</span>
              </div>
            </div>

            {!isAuthenticated && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  You'll need to sign in or create an account with <strong>{invitation?.email}</strong> to accept this invitation.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleAcceptInvitation}
              disabled={accepting}
              className="w-full"
              size="lg"
            >
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept Invitation
                </>
              )}
            </Button>

            <Button
              variant="outline"
              asChild
              className="w-full"
            >
              <Link to="/login">Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
