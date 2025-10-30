import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CouponEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    autoApply: false,
    status: 'active'
  });

  useEffect(() => {
    if (id) {
      loadCoupon();
    }
  }, [id]);

  async function loadCoupon() {
    try {
      const { data, error } = await supabase
        .from('coupon_codes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          code: data.code,
          description: data.description || '',
          discountType: data.discount_type,
          discountValue: data.discount_value,
          minPurchase: data.min_purchase,
          maxDiscount: data.max_discount?.toString() || '',
          totalUsageLimit: data.total_usage_limit?.toString() || '',
          perUserLimit: data.per_user_limit,
          startDate: data.start_date ? new Date(data.start_date).toISOString().split('T')[0] : '',
          endDate: data.end_date ? new Date(data.end_date).toISOString().split('T')[0] : '',
          neverExpires: data.never_expires,
          autoApply: data.auto_apply,
          status: data.status
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      navigate('/admin/coupons');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from('coupon_codes')
        .update({
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
          status: formData.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Coupon updated successfully"
      });
      
      navigate('/admin/coupons');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => navigate('/admin/coupons')}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Coupons
      </Button>

      <h1 className="text-3xl font-bold mb-8">Edit Coupon Code</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-card rounded-lg shadow p-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Coupon Code *
          </label>
          <input
            type="text"
            value={formData.code}
            onChange={(e) =>
              setFormData({ ...formData, code: e.target.value.toUpperCase() })
            }
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary bg-background"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

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

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Coupon
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