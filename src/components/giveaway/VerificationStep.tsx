import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Mail, Phone, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VerificationStepProps {
  entryId: string;
  email: string;
  phone: string;
  onSuccess: (entry: any) => void;
}

export default function VerificationStep({
  entryId,
  email,
  phone,
  onSuccess
}: VerificationStepProps) {
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!emailCode || !phoneCode) {
      toast({
        title: "Missing Codes",
        description: "Please enter both verification codes",
        variant: "destructive"
      });
      return;
    }

    if (emailCode.length !== 6 || phoneCode.length !== 6) {
      toast({
        title: "Invalid Codes",
        description: "Verification codes must be 6 digits",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-giveaway-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            entryId,
            emailCode,
            phoneCode
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      toast({
        title: "Success! 🎉",
        description: `You're entered with ${data.totalEntries} entries!`
      });

      onSuccess(data.entry);

    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: error.message || "Please check your codes and try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCodes = async () => {
    setResending(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            entryId,
            email,
            phone
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to resend codes');
      }

      toast({
        title: "Codes Resent",
        description: "Check your email and phone for new codes"
      });

    } catch (error: any) {
      toast({
        title: "Resend Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-emerald-500 to-blue-500 py-12 px-4">
      <div className="max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-card/95 backdrop-blur p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <ShieldCheck className="w-16 h-16 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold mb-2">Verify Your Entry</h2>
              <p className="text-muted-foreground">
                We've sent verification codes to:
              </p>
            </div>

            {/* Contact Info */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-primary" />
                <span className="font-mono">{email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-primary" />
                <span className="font-mono">{phone}</span>
              </div>
            </div>

            {/* Alert */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-500">
                  <p className="font-semibold mb-1">Check your inbox and messages</p>
                  <p className="text-blue-500/80">
                    Codes expire in 10 minutes. Check spam folder if not received.
                  </p>
                </div>
              </div>
            </div>

            {/* Verification Form */}
            <div className="space-y-4 mb-6">
              {/* Email Code */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Verification Code
                </label>
                <Input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>

              {/* Phone Code */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  SMS Verification Code
                </label>
                <Input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button 
                onClick={handleVerify}
                className="w-full"
                disabled={loading || !emailCode || !phoneCode}
              >
                {loading ? 'Verifying...' : 'Verify & Enter Giveaway'}
              </Button>

              <Button
                onClick={handleResendCodes}
                variant="outline"
                className="w-full"
                disabled={resending}
              >
                {resending ? 'Resending...' : 'Resend Codes'}
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}