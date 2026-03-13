import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface LicenseVerificationProps {
  licenseNumber: string;
  verificationStatus: 'pending' | 'verified' | 'failed' | null;
  onVerify: (licenseNumber: string) => Promise<void>;
}

export function WholesaleClientLicenseVerification({
  licenseNumber,
  verificationStatus,
  onVerify,
}: LicenseVerificationProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [localLicense, setLocalLicense] = useState(licenseNumber);

  const handleVerify = async () => {
    if (!localLicense) {
      toast.error('Enter license number');
      return;
    }

    setIsVerifying(true);
    try {
      await onVerify(localLicense);
      toast.success('License verified');
    } catch (error) {
      toast.error('Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        License Verification
      </h4>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>License Number</Label>
          <Input
            value={localLicense}
            onChange={(e) => setLocalLicense(e.target.value)}
            placeholder="C11-0000123-LIC"
          />
        </div>

        {verificationStatus && (
          <div className="flex items-center gap-2">
            {verificationStatus === 'verified' && (
              <Badge variant="default" className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                Verified
              </Badge>
            )}
            {verificationStatus === 'failed' && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <X className="h-3 w-3" />
                Failed
              </Badge>
            )}
            {verificationStatus === 'pending' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Pending
              </Badge>
            )}
          </div>
        )}

        <Button onClick={handleVerify} disabled={isVerifying} className="w-full">
          {isVerifying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify License'
          )}
        </Button>
      </div>
    </Card>
  );
}
