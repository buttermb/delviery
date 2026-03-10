import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface DetailsStepProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
}

export const DetailsStep = ({
  name,
  onNameChange,
  description,
  onDescriptionChange,
}: DetailsStepProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Menu Details</h3>
      <div className="space-y-2">
        <Label htmlFor="menuName">Menu Name *</Label>
        <Input
          id="menuName"
          placeholder="VIP Wholesale Clients - Q1 2025"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          This name is only visible to you, not to customers
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="menuDescription">Description (Optional)</Label>
        <Textarea
          id="menuDescription"
          placeholder="Premium products for exclusive clients..."
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
};
