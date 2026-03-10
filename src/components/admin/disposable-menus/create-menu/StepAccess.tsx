import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import type { AccessType } from './types';
import { generateAccessCode } from './types';
import { QRCodePlaceholder } from './QRCodePlaceholder';

interface StepAccessProps {
  accessType: AccessType;
  onAccessTypeChange: (value: AccessType) => void;
  requireAccessCode: boolean;
  onRequireAccessCodeChange: (value: boolean) => void;
  accessCode: string;
  onAccessCodeChange: (value: string) => void;
}

export function StepAccess({
  accessType,
  onAccessTypeChange,
  requireAccessCode,
  onRequireAccessCodeChange,
  accessCode,
  onAccessCodeChange,
}: StepAccessProps) {
  const generateNewCode = () => {
    onAccessCodeChange(generateAccessCode());
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Access Control</h3>

      <div className="space-y-3">
        <Label>Access Type</Label>
        <RadioGroup
          value={accessType}
          onValueChange={(value: string) =>
            onAccessTypeChange(value as AccessType)
          }
        >
          <div className="flex items-start space-x-2 border rounded p-3">
            <RadioGroupItem value="invite_only" id="invite_only" />
            <div className="flex-1">
              <Label htmlFor="invite_only" className="font-medium">
                Invite-Only (Most Secure)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Each customer gets unique link. Track who accessed when.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2 border rounded p-3">
            <RadioGroupItem value="shared" id="shared" />
            <div className="flex-1">
              <Label htmlFor="shared" className="font-medium">
                Shared Link (Less Secure)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                One link for all customers. Easier to distribute.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2 border rounded p-3">
            <RadioGroupItem value="hybrid" id="hybrid" />
            <div className="flex-1">
              <Label htmlFor="hybrid" className="font-medium">
                Hybrid (Balanced)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Shared link + customer verification required.
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      <div className="flex items-center justify-between border rounded p-3">
        <div>
          <Label>Require Access Code</Label>
          <p className="text-xs text-muted-foreground">
            8-character alphanumeric code for additional security
          </p>
        </div>
        <Switch checked={requireAccessCode} onCheckedChange={onRequireAccessCodeChange} />
      </div>

      {requireAccessCode && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>Access Code</Label>
              <Input value={accessCode} readOnly />
            </div>
            <Button variant="outline" onClick={generateNewCode} className="mt-6">
              Generate New
            </Button>
          </div>
          {/* QR Code preview */}
          <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30">
            <QRCodePlaceholder value={accessCode} size={80} />
            <div className="text-sm">
              <p className="font-medium">QR Code Preview</p>
              <p className="text-xs text-muted-foreground">
                Customers can scan this to access the menu
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
