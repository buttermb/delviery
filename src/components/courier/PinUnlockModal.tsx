import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';

interface PinUnlockModalProps {
  open: boolean;
  onUnlock: (pin: string) => Promise<boolean>;
}

export default function PinUnlockModal({ open, onUnlock }: PinUnlockModalProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (pin.length < 4) {
      toast.error('Enter your PIN');
      return;
    }

    setLoading(true);
    try {
      const success = await onUnlock(pin);
      if (!success) {
        toast.error('Incorrect PIN');
        setPin('');
      }
    } catch (error) {
      toast.error('Failed to unlock');
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
            Enter Your PIN
          </DialogTitle>
          <DialogDescription>
            Enter your security PIN to access the courier dashboard
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter PIN"
            className="text-center text-2xl tracking-widest"
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />

          <Button 
            onClick={handleSubmit} 
            disabled={loading || !pin}
            className="w-full"
            size="lg"
          >
            {loading ? 'Verifying...' : 'Unlock'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
