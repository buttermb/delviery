import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function CouponForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: 10,
    minPurchase: 0,
    maxDiscount: '',
    totalUsageLimit: '',
    perUserLimit: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    neverExpires: false,
    autoApply: false
  });

  const generateCode = () => {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    setFormData({ ...formData, code });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('coupon_codes').insert({
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        discount_type: formData.discountType,
        discount_value: formData.discountValue,
        min_purchase: formData.minPurchase,
        max_discount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
        total_usage_limit: formData.totalUsageLimit ? parseInt(formData.totalUsageLimit) : null,
        per_user_limit: formData.perUserLimit,
        start_date: formData.startDate,
        end_date: formData.neverExpires ? null : (formData.endDate || null),
        never_expires: formData.neverExpires,
        auto_apply: formData.autoApply,
        status: 'active'
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Coupon created successfully"
      });
      
      navigate('/admin/coupons');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Create Coupon Code</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-card rounded-lg shadow p-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Coupon Code *
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.code}
              onChange={(e) =>
                setFormData({ ...formData, code: e.target.value.toUpperCase() })
              }
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
              placeholder="SUMMER25"
              required
            />
            <button
              type="button"
              onClick={generateCode}
              className="px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
            >
              Generate
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
            placeholder="Internal note about this coupon"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Discount Type *
            </label>
            <select
              value={formData.discountType}
              onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Discount Value *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.discountValue}
                onChange={(e) =>
                  setFormData({ ...formData, discountValue: parseFloat(e.target.value) })
                }
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
                required
                min="0"
                step="0.01"
              />
              <span className="text-muted-foreground">
                {formData.discountType === 'percentage' ? '%' : '$'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Minimum Purchase ($)
            </label>
            <input
              type="number"
              value={formData.minPurchase}
              onChange={(e) =>
                setFormData({ ...formData, minPurchase: parseFloat(e.target.value) })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
              min="0"
              step="0.01"
            />
          </div>

          {formData.discountType === 'percentage' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Maximum Discount ($)
              </label>
              <input
                type="number"
                value={formData.maxDiscount}
                onChange={(e) =>
                  setFormData({ ...formData, maxDiscount: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
                placeholder="No limit"
                min="0"
                step="0.01"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Total Usage Limit
            </label>
            <input
              type="number"
              value={formData.totalUsageLimit}
              onChange={(e) =>
                setFormData({ ...formData, totalUsageLimit: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
              placeholder="Unlimited"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Per User Limit *
            </label>
            <input
              type="number"
              value={formData.perUserLimit}
              onChange={(e) =>
                setFormData({ ...formData, perUserLimit: parseInt(e.target.value) })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
              min="1"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Start Date *
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              End Date
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
              disabled={formData.neverExpires}
            />
            <label className="flex items-center mt-2">
              <input
                type="checkbox"
                checked={formData.neverExpires}
                onChange={(e) =>
                  setFormData({ ...formData, neverExpires: e.target.checked })
                }
                className="mr-2"
              />
              <span className="text-sm text-muted-foreground">Never expires</span>
            </label>
          </div>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.autoApply}
              onChange={(e) => setFormData({ ...formData, autoApply: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm">
              Auto-apply to qualifying orders
            </span>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Coupon
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/coupons')}
            className="px-6 py-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}