import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Check, X, Tag } from 'lucide-react';
import { validateCoupon } from '@/lib/api/coupons';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface CouponInputProps {
  cartTotal: number;
  onCouponApplied: (discount: number, code: string) => void;
  onCouponRemoved: () => void;
  appliedCode?: string;
}

export default function CouponInput({ 
  cartTotal, 
  onCouponApplied, 
  onCouponRemoved,
  appliedCode 
}: CouponInputProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleApply = async () => {
    if (!code.trim()) return;

    setLoading(true);
    try {
      const result = await validateCoupon(code, user?.id || null, cartTotal);
      
      if (result.valid) {
        onCouponApplied(result.discount, code.toUpperCase());
        toast({
          title: "Coupon Applied!",
          description: result.message || `You saved $${result.discount.toFixed(2)}`
        });
        setCode('');
      } else {
        toast({
          title: "Invalid Coupon",
          description: result.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to validate coupon",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    onCouponRemoved();
    toast({
      title: "Coupon Removed",
      description: "Coupon has been removed from your order"
    });
  };

  if (appliedCode) {
    return (
      <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <Tag className="w-4 h-4 text-primary" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-sm">{appliedCode}</span>
            <Check className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">Coupon applied</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          className="h-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        id="coupon-code-input"
        name="coupon"
        type="text"
        autoComplete="off"
        placeholder="Enter coupon code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyPress={(e) => e.key === 'Enter' && handleApply()}
        className="flex-1"
      />
      <Button
        onClick={handleApply}
        disabled={loading || !code.trim()}
        className="px-6"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          'Apply'
        )}
      </Button>
    </div>
  );
}