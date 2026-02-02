/**
 * Approval Banner Component
 * Shows approval status and prompts user to request access
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import { Link } from 'react-router-dom';
import { useForumApproval } from '@/hooks/useForumApproval';
import { useForumProfile } from '@/hooks/useForumProfile';

export function ApprovalBanner() {
  const { data: approval, isLoading } = useForumApproval();
  const { data: profile } = useForumProfile();

  if (isLoading) return null;
  
  // Don't show if user has profile (they're already set up)
  if (profile) return null;
  
  if (!approval) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Forum Access Required</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>You need to be approved to participate in the forum.</span>
          <Button asChild size="sm" className="ml-4">
            <Link to="/community/approval">Request Access</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (approval.status === 'approved') {
    return null; // Don't show banner if approved
  }

  if (approval.status === 'pending') {
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Approval Pending</AlertTitle>
        <AlertDescription>
          Your forum access request is pending review. You'll be notified when approved.
        </AlertDescription>
      </Alert>
    );
  }

  if (approval.status === 'rejected') {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          {approval.rejection_reason || 'Your forum access request was denied.'}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

