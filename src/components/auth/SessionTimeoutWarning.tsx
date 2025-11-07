import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SessionTimeoutWarningProps {
  open: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
  secondsRemaining: number;
}

export const SessionTimeoutWarning = ({
  open,
  onStayLoggedIn,
  onLogout,
  secondsRemaining,
}: SessionTimeoutWarningProps) => {
  const [countdown, setCountdown] = useState(secondsRemaining);

  useEffect(() => {
    if (!open) {
      setCountdown(secondsRemaining);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, secondsRemaining, onLogout]);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session Expiring Soon</AlertDialogTitle>
          <AlertDialogDescription>
            Your session will expire in <span className="font-semibold text-destructive">{countdown} seconds</span>.
            Would you like to stay logged in?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onLogout}>Logout Now</AlertDialogCancel>
          <AlertDialogAction onClick={onStayLoggedIn}>Stay Logged In</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
