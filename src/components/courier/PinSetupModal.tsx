import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

interface PinSetupModalProps {
  open: boolean;
  onPinSet: (pin: string) => Promise<void>;
}

export default function PinSetupModal({ open, onPinSet }: PinSetupModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (pin.length < 4 || pin.length > 6) {
      toast.error('PIN must be 4-6 digits');
      return;
    }

    if (pin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }

    if (!/^\d+$/.test(pin)) {
      toast.error('PIN must contain only numbers');
      return;
    }

    setLoading(true);
    try {
      await onPinSet(pin);
      toast.success('PIN set successfully');
    } catch (error) {
      toast.error('Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Set Up Security PIN
          </DialogTitle>
          <DialogDescription>
            Create a 4-6 digit PIN to secure your courier account. You'll need this PIN every time you use the app.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Enter PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4-6 digits"
              className="text-center text-2xl tracking-widest"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Confirm PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Re-enter PIN"
              className="text-center text-2xl tracking-widest"
              autoComplete="off"
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={loading || !pin || !confirmPin}
            className="w-full"
            size="lg"
          >
            {loading ? 'Setting up...' : 'Set PIN'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
