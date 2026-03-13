/**
 * Storefront Age Verification Gate Component
 * Modal requiring age confirmation before accessing store
 */

import { useState } from 'react';
import { AlertTriangle, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AgeVerificationGateProps {
  isOpen: boolean;
  onVerified: () => void;
  onDeclined: () => void;
  storeName: string;
  minimumAge?: number;
}

export default function AgeVerificationGate({
  isOpen,
  onVerified,
  onDeclined,
  storeName,
  minimumAge = 21,
}: AgeVerificationGateProps) {
  const [isAgeConfirmed, setIsAgeConfirmed] = useState(false);
  const [showError, setShowError] = useState(false);

  const handleVerify = () => {
    if (!isAgeConfirmed) {
      setShowError(true);
      return;
    }
    onVerified();
  };

  const handleDecline = () => {
    onDeclined();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-amber-600 dark:text-amber-500" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Age Verification Required</DialogTitle>
          <DialogDescription className="text-center">
            You must be {minimumAge} years or older to enter {storeName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning Alert */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This website contains cannabis products intended for adults {minimumAge}+. By
              entering, you certify that you are of legal age in your jurisdiction.
            </AlertDescription>
          </Alert>

          {/* Confirmation Checkbox */}
          <div className="flex items-start space-x-3 p-4 border rounded-lg bg-muted/50">
            <Checkbox
              id="age-confirm"
              checked={isAgeConfirmed}
              onCheckedChange={(checked) => {
                setIsAgeConfirmed(checked === true);
                setShowError(false);
              }}
            />
            <Label
              htmlFor="age-confirm"
              className="text-sm font-medium leading-relaxed cursor-pointer"
            >
              I certify that I am {minimumAge} years of age or older and agree to comply with all
              applicable laws regarding the purchase and use of cannabis products.
            </Label>
          </div>

          {showError && (
            <Alert variant="destructive">
              <AlertDescription>
                You must confirm that you are {minimumAge}+ to continue.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={handleVerify} className="w-full">
              I am {minimumAge}+ - Enter Store
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleDecline}
              className="w-full text-muted-foreground"
            >
              I am under {minimumAge} - Exit
            </Button>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-center text-muted-foreground">
            By entering this site, you accept our Terms of Service and Privacy Policy. Cannabis
            products are for medical or adult-use only where legally permitted.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
