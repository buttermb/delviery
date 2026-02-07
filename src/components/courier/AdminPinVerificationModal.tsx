import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';

interface AdminPinVerificationModalProps {
  open: boolean;
  onVerify: (pin: string) => Promise<boolean>;
}

export default function AdminPinVerificationModal({ open, onVerify }: AdminPinVerificationModalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (pin.length !== 6) {
      toast.error('Admin PIN must be 6 digits');
      return;
    }

    setLoading(true);
    try {
      const success = await onVerify(pin);
      if (!success) {
        toast.error('Invalid Admin PIN. Contact your administrator.');
        setPin('');
      } else {
        toast.success('Admin PIN verified successfully');
      }
    } catch (error) {
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Admin PIN Required
          </DialogTitle>
          <DialogDescription>
            Enter the 6-digit Admin PIN provided by your administrator to activate your courier account.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Admin PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit PIN"
              className="text-center text-2xl tracking-widest"
              autoComplete="off"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={loading || pin.length !== 6}
            className="w-full"
            size="lg"
          >
            {loading ? 'Verifying...' : 'Verify PIN'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Don't have an Admin PIN? Contact your administrator to get one assigned.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}