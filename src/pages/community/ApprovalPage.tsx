/**
 * Approval Page
 * Request forum access approval
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useForumApproval, useRequestForumApproval } from '@/hooks/useForumApproval';
import { useCreateForumProfile } from '@/hooks/useForumProfile';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { validateUsername } from '@/lib/utils/forumHelpers';
import { toast } from 'sonner';

export function ApprovalPage() {
  const navigate = useNavigate();
  const { data: approval, isLoading: approvalLoading } = useForumApproval();
  const requestApprovalMutation = useRequestForumApproval();
  const createProfileMutation = useCreateForumProfile();
  const [requestMessage, setRequestMessage] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const handleRequestApproval = async () => {
    try {
      await requestApprovalMutation.mutateAsync({
        request_message: requestMessage || undefined,
      });
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCreateProfile = async () => {
    if (!username.trim()) {
      toast.error('Username is required');
      return;
    }

    // Validate username
    const validation = validateUsername(username.trim());
    if (!validation.valid) {
      setUsernameError(validation.error || 'Invalid username');
      toast.error(validation.error || 'Invalid username');
      return;
    }

    setUsernameError(null);

    try {
      await createProfileMutation.mutateAsync({
        username: username.trim(),
        display_name: displayName.trim() || undefined,
      });
      navigate('/community');
    } catch (error) {
      // Error handled by mutation
      if (error instanceof Error && error.message.includes('unique')) {
        setUsernameError('Username already taken');
      }
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameError(null);
    
    // Real-time validation
    if (value.trim()) {
      const validation = validateUsername(value.trim());
      if (!validation.valid) {
        setUsernameError(validation.error || undefined);
      }
    }
  };

  if (approvalLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If approved but no profile, show profile creation form
  if (approval?.status === 'approved' && !approvalLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/community">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Create Your Forum Profile</CardTitle>
            <CardDescription>
              You've been approved! Create your username to start posting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Your forum access has been approved. Create a username to get started.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                placeholder="Choose a unique username"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                maxLength={50}
                className={usernameError ? 'border-destructive' : ''}
              />
              {usernameError && (
                <p className="text-xs text-destructive">{usernameError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Username must be 3-50 characters, alphanumeric with underscores or hyphens.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name (optional)</Label>
              <Input
                id="displayName"
                placeholder="Your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
              />
            </div>

            <Button
              onClick={handleCreateProfile}
              disabled={!username.trim() || createProfileMutation.isPending}
              className="w-full"
            >
              {createProfileMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Profile'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If pending, show status
  if (approval?.status === 'pending') {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/community">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Approval Pending</CardTitle>
            <CardDescription>
              Your forum access request is being reviewed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                We're reviewing your request. You'll be notified when approved.
                {approval.auto_approved && ' (Auto-approved based on existing orders)'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If rejected, show rejection reason
  if (approval?.status === 'rejected') {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/community">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Your forum access request was not approved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {approval.rejection_reason || 'Your request was denied. Please contact support for more information.'}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No approval yet, show request form
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/community">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Request Forum Access</CardTitle>
          <CardDescription>
            Join the FloraIQ community to discuss products, share experiences, and connect with others.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Tell us why you'd like to join the forum..."
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              If you have existing orders, you'll be auto-approved.
            </p>
          </div>

          <Button
            onClick={handleRequestApproval}
            disabled={requestApprovalMutation.isPending}
            className="w-full"
          >
            {requestApprovalMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Request Access'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

