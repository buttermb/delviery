import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, Copy, Key } from 'lucide-react';

interface CourierPinManagementProps {
  courierId: string;
  currentPin?: string;
  courierName: string;
}

export default function CourierPinManagement({ courierId, currentPin, courierName }: CourierPinManagementProps) {
  const [pin, setPin] = useState(''); // Always start with empty field
  const [loading, setLoading] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [savedPin, setSavedPin] = useState<string>('');
  const hasPinSet = currentPin && currentPin.startsWith('$sha256$');

  const generatePin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('generate_admin_pin');
      
      if (error) throw error;
      
      setPin(data);
      toast.success('PIN generated - remember to save it!');
    } catch (error) {
      toast.error('Failed to generate PIN');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const savePin = async () => {
    if (!pin || pin.length !== 6) {
      toast.error('PIN must be 6 digits');
      return;
    }

    if (!pinCopied) {
      toast.error('Please copy the PIN first - you won\'t see it again!');
      return;
    }

    setLoading(true);
    try {
      // Store the plain PIN temporarily to show after save
      const plainPin = pin;
      
      // Hash the PIN using the database function to ensure consistency with verification
      const { data: hashedPin, error: hashError } = await supabase.rpc('hash_admin_pin', {
        pin_text: pin
      });
      
      if (hashError) throw hashError;
      
      console.log('Saving PIN for courier:', courierId);
      console.log('Plain PIN (for debugging):', plainPin);
      console.log('Hashed PIN:', hashedPin);
      
      const { error } = await supabase
        .from('couriers')
        .update({ 
          admin_pin: hashedPin, 
          admin_pin_verified: false,
          pin_set_at: new Date().toISOString()
        })
        .eq('id', courierId);

      if (error) throw error;

      // Log security event
      await supabase.from('security_events').insert({
        event_type: 'courier_pin_updated',
        details: { 
          courier_id: courierId,
          courier_name: courierName,
          timestamp: new Date().toISOString(),
          action: 'Admin set new PIN - courier must re-verify'
        }
      });

      setSavedPin(plainPin); // Store for confirmation display
      toast.success(`Admin PIN saved! ${courierName} will need to verify with the new PIN on their next login.`);
      
      // Clear the input but keep savedPin for reference
      setPin('');
      setPinCopied(false);
    } catch (error) {
      toast.error('Failed to save PIN');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const copyPin = () => {
    navigator.clipboard.writeText(pin);
    setPinCopied(true);
    toast.success('PIN copied! Now you can save it.');
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Key className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Admin PIN Management</h3>
      </div>

      <div className="space-y-3">
        {hasPinSet && !savedPin && (
          <div className="p-3 bg-muted border border-border rounded-lg">
            <p className="text-sm font-medium mb-1">Current Status:</p>
            <p className="text-sm text-muted-foreground">PIN is already set for this courier</p>
            <p className="text-xs text-muted-foreground mt-1">
              Set a new PIN below to replace it
            </p>
          </div>
        )}
        
        {savedPin && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm font-semibold text-primary mb-1">Last Saved PIN:</p>
            <p className="text-2xl font-mono tracking-widest text-center">{savedPin}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Give this PIN to {courierName} for their first login
            </p>
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="pin-input" className="text-sm font-medium">
            Enter or Generate 6-Digit PIN
          </Label>
          <div className="flex gap-2">
            <Input
              id="pin-input"
              type="text"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                setPinCopied(false);
              }}
              placeholder="Type your own PIN"
              maxLength={6}
              className="text-center text-lg tracking-widest font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={generatePin}
              disabled={loading}
              title="Generate random PIN"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant={pinCopied ? "default" : "outline"}
              size="icon"
              onClick={copyPin}
              disabled={!pin}
              title="Copy PIN"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {pin && !pinCopied && (
          <p className="text-xs text-yellow-600 dark:text-yellow-500 font-medium">
            ⚠️ Copy the PIN before saving - you won't see it again!
          </p>
        )}

        <Button
          onClick={savePin}
          disabled={loading || !pin || pin.length !== 6 || !pinCopied}
          className="w-full"
        >
          {loading ? 'Saving...' : pinCopied ? 'Save Admin PIN' : 'Copy PIN First'}
        </Button>

        <p className="text-xs text-muted-foreground">
          1. Generate or enter a 6-digit PIN<br/>
          2. Copy the PIN (required)<br/>
          3. Save the PIN - it will be securely hashed<br/>
          4. Give the PIN to {courierName} for their first login
        </p>
      </div>
    </Card>
  );
}
