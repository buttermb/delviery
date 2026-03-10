import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Mail, Phone, X } from 'lucide-react';
import { toast } from 'sonner';

interface StepWhitelistProps {
  whitelistEnabled: boolean;
  onWhitelistEnabledChange: (value: boolean) => void;
  whitelistedEmails: string[];
  onWhitelistedEmailsChange: (emails: string[]) => void;
  whitelistedPhones: string[];
  onWhitelistedPhonesChange: (phones: string[]) => void;
}

export function StepWhitelist({
  whitelistEnabled,
  onWhitelistEnabledChange,
  whitelistedEmails,
  onWhitelistedEmailsChange,
  whitelistedPhones,
  onWhitelistedPhonesChange,
}: StepWhitelistProps) {
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const addEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (whitelistedEmails.includes(trimmed)) {
      toast.error('Email already added');
      return;
    }
    onWhitelistedEmailsChange([...whitelistedEmails, trimmed]);
    setNewEmail('');
  };

  const removeEmail = (email: string) => {
    onWhitelistedEmailsChange(whitelistedEmails.filter((e) => e !== email));
  };

  const addPhone = () => {
    const trimmed = newPhone.trim();
    if (!trimmed || trimmed.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    if (whitelistedPhones.includes(trimmed)) {
      toast.error('Phone already added');
      return;
    }
    onWhitelistedPhonesChange([...whitelistedPhones, trimmed]);
    setNewPhone('');
  };

  const removePhone = (phone: string) => {
    onWhitelistedPhonesChange(whitelistedPhones.filter((p) => p !== phone));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Access Whitelist</h3>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Whitelist</Label>
            <p className="text-xs text-muted-foreground">
              Only allow access from specific emails or phone numbers
            </p>
          </div>
          <Switch checked={whitelistEnabled} onCheckedChange={onWhitelistEnabledChange} />
        </div>
      </div>

      {whitelistEnabled && (
        <>
          {/* Email whitelist */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Whitelisted Emails
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="customer@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
              />
              <Button variant="outline" onClick={addEmail}>
                Add
              </Button>
            </div>
            {whitelistedEmails.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {whitelistedEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      onClick={() => removeEmail(email)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Phone whitelist */}
          <div className="border rounded-lg p-4 space-y-3">
            <Label className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Whitelisted Phones
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="+1 (555) 123-4567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPhone()}
              />
              <Button variant="outline" onClick={addPhone}>
                Add
              </Button>
            </div>
            {whitelistedPhones.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {whitelistedPhones.map((phone) => (
                  <Badge key={phone} variant="secondary" className="gap-1">
                    {phone}
                    <button
                      onClick={() => removePhone(phone)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
