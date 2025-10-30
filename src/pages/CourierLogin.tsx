import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package } from 'lucide-react';
import { useCourier } from '@/contexts/CourierContext';
import AdminPinVerificationModal from '@/components/courier/AdminPinVerificationModal';

export default function CourierLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [courierUserId, setCourierUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { courier, refreshCourier } = useCourier();

  // Redirect if already logged in as courier
  useEffect(() => {
    if (courier) {
      navigate('/courier/dashboard', { replace: true });
    }
  }, [courier, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) throw authError;

      // Verify courier account exists and is active
      const { data: courierData, error: courierError } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (courierError) throw courierError;
      if (!courierData) {
        await supabase.auth.signOut();
        throw new Error('Courier account not found');
      }

      if (!courierData.is_active) {
        await supabase.auth.signOut();
        throw new Error('Your courier account is inactive. Please contact support.');
      }

      // Check if admin PIN is required (first login)
      if (courierData.admin_pin && !courierData.admin_pin_verified) {
        setCourierUserId(authData.user.id);
        setShowAdminPinModal(true);
        return;
      }

      // Refresh courier context to load data
      await refreshCourier();
      
      toast({
        title: "Welcome back!",
        description: "Redirecting to dashboard..."
      });

      // Small delay to ensure context is updated
      setTimeout(() => {
        navigate('/courier/dashboard', { replace: true });
      }, 100);
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminPinVerify = async (pin: string): Promise<boolean> => {
    if (!courierUserId) return false;

    try {
      console.log('Verifying admin PIN for user:', courierUserId);
      console.log('PIN entered:', pin);
      
      const { data, error } = await supabase.rpc('verify_admin_pin', {
        courier_user_id: courierUserId,
        pin
      });

      console.log('Verification result:', data);
      if (error) {
        console.error('RPC error:', error);
        throw error;
      }

      if (data) {
        // Mark admin PIN as verified
        await supabase
          .from('couriers')
          .update({ admin_pin_verified: true })
          .eq('user_id', courierUserId);

        setShowAdminPinModal(false);
        await refreshCourier();
        
        toast({
          title: "Verification complete!",
          description: "Redirecting to dashboard..."
        });

        setTimeout(() => {
          navigate('/courier/dashboard', { replace: true });
        }, 100);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Admin PIN verification error:', error);
      return false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Package className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Courier Login</CardTitle>
          <CardDescription>
            Sign in to start accepting deliveries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="courier@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <Link to="/admin/login" className="text-primary hover:underline">
              Admin login
            </Link>
          </div>
        </CardContent>
      </Card>
      
      <AdminPinVerificationModal
        open={showAdminPinModal}
        onVerify={handleAdminPinVerify}
      />
    </div>
  );
}
