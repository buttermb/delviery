import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Copy, Edit, Archive, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  status: string;
  discount_type: string;
  discount_value: number;
  min_purchase: number;
  max_discount: number | null;
  total_usage_limit: number | null;
  used_count: number;
  never_expires: boolean;
  end_date: string | null;
}

export default function CouponList() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadCoupons();
  }, []);

  async function loadCoupons() {
    const { data, error } = await supabase
      .from('coupon_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setCoupons(data);
    setLoading(false);
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: `Code "${code}" copied to clipboard`
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Coupon Codes</h1>
        <Link
          to="/admin/coupons/create"
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Coupon
        </Link>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center py-12 bg-muted rounded-lg">
          <p className="text-muted-foreground mb-4">No coupons created yet</p>
          <Link
            to="/admin/coupons/create"
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Create Your First Coupon
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="bg-card rounded-lg shadow p-6 border"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold font-mono">{coupon.code}</h3>
                    <button
                      onClick={() => copyCode(coupon.code)}
                      className="p-1 hover:bg-muted rounded transition-colors"
                    >
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <p className="text-muted-foreground">{coupon.description}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    coupon.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {coupon.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {coupon.discount_type === 'percentage'
                      ? `${coupon.discount_value}%`
                      : `$${coupon.discount_value}`}
                  </div>
                  <div className="text-sm text-muted-foreground">Discount</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {coupon.used_count}
                    {coupon.total_usage_limit && ` / ${coupon.total_usage_limit}`}
                  </div>
                  <div className="text-sm text-muted-foreground">Uses</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {coupon.min_purchase > 0 ? `$${coupon.min_purchase}` : 'None'}
                  </div>
                  <div className="text-sm text-muted-foreground">Min Purchase</div>
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {coupon.never_expires
                      ? 'Never expires'
                      : coupon.end_date
                      ? new Date(coupon.end_date).toLocaleDateString()
                      : 'N/A'}
                  </div>
                  <div className="text-sm text-muted-foreground">Expires</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/admin/coupons/${coupon.id}/edit`}
                  className="flex items-center gap-2 text-sm bg-muted px-3 py-2 rounded hover:bg-muted/80 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Link>
                <button className="flex items-center gap-2 text-sm bg-muted px-3 py-2 rounded hover:bg-muted/80 transition-colors">
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}