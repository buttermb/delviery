import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Percent, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DiscountRule {
  id: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_order_amount?: number;
  applies_to: 'all' | 'category' | 'product';
}

interface WholesaleClientDiscountRulesProps {
  rules: DiscountRule[];
  onAddRule: (rule: Omit<DiscountRule, 'id'>) => void;
  onRemoveRule: (id: string) => void;
}

export function WholesaleClientDiscountRules({
  rules,
  onAddRule,
  onRemoveRule,
}: WholesaleClientDiscountRulesProps) {
  const [newRule, setNewRule] = useState({
    type: 'percentage' as const,
    value: '',
    min_order_amount: '',
    applies_to: 'all' as const,
  });

  const handleAdd = () => {
    if (!newRule.value) {
      toast.error('Enter discount value');
      return;
    }

    onAddRule({
      type: newRule.type,
      value: parseFloat(newRule.value),
      min_order_amount: newRule.min_order_amount ? parseFloat(newRule.min_order_amount) : undefined,
      applies_to: newRule.applies_to,
    });

    setNewRule({
      type: 'percentage',
      value: '',
      min_order_amount: '',
      applies_to: 'all',
    });
    toast.success('Discount rule added');
  };

  return (
    <Card className="p-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Percent className="h-4 w-4" />
        Discount Rules
      </h4>

      <div className="space-y-3 mb-4">
        {rules.map((rule) => (
          <div key={rule.id} className="flex items-center gap-2 p-2 bg-muted rounded">
            <Badge variant={rule.type === 'percentage' ? 'default' : 'secondary'}>
              {rule.type === 'percentage' ? `${rule.value}%` : `$${rule.value}`}
            </Badge>
            <span className="text-sm flex-1">
              on {rule.applies_to}
              {rule.min_order_amount && ` (min $${rule.min_order_amount})`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveRule(rule.id)}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-3 p-3 border rounded">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={newRule.type} onValueChange={(v) => setNewRule({ ...newRule, type: v as 'percentage' | 'fixed' })}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Value</Label>
            <Input
              type="number"
              step="0.01"
              className="h-9"
              value={newRule.value}
              onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
              placeholder={newRule.type === 'percentage' ? '10' : '50'}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Min Order Amount (Optional)</Label>
          <Input
            type="number"
            step="1"
            className="h-9"
            value={newRule.min_order_amount}
            onChange={(e) => setNewRule({ ...newRule, min_order_amount: e.target.value })}
            placeholder="500"
          />
        </div>
        <Button onClick={handleAdd} size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>
    </Card>
  );
}
