import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ForceLightMode } from '@/components/marketing/ForceLightMode';
import { Label } from '@/components/ui/label';
import { Mail, Check, Loader2, AlertCircle, ArrowLeft, Leaf, Star, ShieldCheck, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handleError } from '@/utils/errorHandling/handlers';
import FloraIQLogo from '@/components/FloraIQLogo';
import { motion } from 'framer-motion';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    if (location.state) {
      setEmail(location.state.email || '');
      setTenantId(location.state.tenantId || '');
    }
  }, [location]);

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter the 6-digit verification code',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });

      if (error) throw error;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug')
        .eq('id', tenantId)
        .maybeSingle();

      if (data.user) {
        if (tenantId) {
          await supabase
            .from('tenant_users')
            .update({
              status: 'active',
              email_verified: true,
              accepted_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenantId)
            .eq('email', email);
        }

        toast({
          title: 'Email Verified!',
          description: 'Your account has been activated',
        });

        if (tenant?.slug) {
          navigate(`/${tenant.slug}/admin/welcome`);
        } else {
          navigate('/signup');
        }
      }
    } catch (error) {
      handleError(error, { component: 'VerifyEmailPage', toastTitle: 'Verification Failed' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) throw error;

      toast({
        title: 'Code Resent',
        description: 'Check your email for the new verification code',
      });
    } catch (error) {
      handleError(error, { component: 'VerifyEmailPage', toastTitle: 'Failed to Resend' });
    }
  };

  return (
    <ForceLightMode>
      <div className="min-h-screen flex w-full bg-background font-sans">
        {/* LEFT SIDE - FORM */}
        <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-[45%] xl:w-[40%] bg-background relative z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="absolute top-8 left-8 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="mx-auto w-full max-w-sm">
            <div className="mb-10">
              <FloraIQLogo size="lg" className="mb-6" />
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <Mail className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Verify Email</h1>
              </div>
              <p className="text-muted-foreground">
                We've sent a 6-digit verification code to <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm font-medium">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="h-14 text-center text-3xl tracking-[0.5em] font-mono font-medium border-slate-200 focus:border-primary focus:ring-primary rounded-xl"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleVerify}
                disabled={isVerifying || code.length !== 6}
                className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Verify Email
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground mb-2">Didn't receive code?</p>
                <Button
                  variant="link"
                  onClick={handleResend}
                  className="text-primary font-semibold hover:underline p-0 h-auto"
                >
                  Resend Verification Code
                </Button>
              </div>

              <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4 flex items-start gap-3 mt-6">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium mb-1">Check Spam Folder</p>
                  <p className="text-orange-700/80">If you don't see it within a minute, check your spam or junk folder.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - BRANDING */}
        <div className="hidden lg:flex w-[60%] bg-primary relative overflow-hidden items-center justify-center p-12">
          {/* Background Image / Gradient */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1628126235206-5260b9ea6441?q=80&w=2574&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay filter blur-[1px]"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary-dark/95"></div>

            {/* Animated Orbs */}
            <motion.div
              animate={{ y: [0, -20, 0], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 8, repeat: Infinity }}
              className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px]"
            />
            <motion.div
              animate={{ y: [0, 30, 0], opacity: [0.2, 0.4, 0.2] }}
              transition={{ duration: 10, repeat: Infinity, delay: 1 }}
              className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px]"
            />
          </div>

          {/* Testimonial Content (Same as Login Page for Consistency) */}
          <div className="relative z-10 max-w-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="glass-card bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-20">
                <Leaf className="w-24 h-24 rotate-12" />
              </div>

              <div className="flex gap-1 mb-6 text-accent">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-current" />)}
              </div>

              <blockquote className="text-2xl leading-relaxed mb-8 font-light">
                "Security is our top priority. FloraIQ's platform gives us peace of mind with enterprise-grade protection."
              </blockquote>

              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/50 to-accent flex items-center justify-center text-primary-foreground font-bold text-lg">
                  JD
                </div>
                <div>
                  <div className="font-bold text-lg">James Dalton</div>
                  <div className="text-white/80 text-sm">CTO, SecureCann Logistics</div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  <span>SOC2 Compliant</span>
                </div>
                <div>End-to-End Encryption</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </ForceLightMode>
  );
}
