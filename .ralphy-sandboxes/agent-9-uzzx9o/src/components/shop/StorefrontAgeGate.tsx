import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

interface StorefrontAgeGateProps {
  storeName: string;
  logoUrl?: string | null;
  minimumAge: number;
  primaryColor?: string;
  onVerify: (verified: boolean) => void;
}

export function StorefrontAgeGate({
  storeName,
  logoUrl,
  minimumAge,
  primaryColor = '#10b981',
  onVerify,
}: StorefrontAgeGateProps) {
  const handleReject = () => {
    onVerify(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 25 }}
        >
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center space-y-4 pt-8">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="h-16 mx-auto mb-2 object-contain"
                />
              ) : (
                <div
                  className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-2"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                    <Card className="w-full max-w-md bg-zinc-950 border-zinc-800 text-white shadow-2xl" data-dark-panel data-testid="age-verification-modal">
                        <CardHeader className="text-center space-y-4 pt-8">
                            <div className="mx-auto w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center mb-2">
                                <ShieldCheck className="w-8 h-8 text-emerald-500" />
                            </div>
                            <CardTitle className="text-2xl font-light tracking-wide">
                                Age Verification
                            </CardTitle>
                            <CardDescription className="text-zinc-400 text-base">
                                You must be at least <span className="text-white font-bold">{minAge}</span> years old to access this site.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pb-8">
                            <Button
                                className="w-full h-12 text-lg font-medium bg-white text-black hover:bg-zinc-200 transition-colors"
                                onClick={handleVerify}
                            >
                                I am {minAge}+
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full h-12 text-lg font-medium border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                                onClick={handleReject}
                            >
                                Leave Site
                            </Button>
                            <p className="text-center text-xs text-zinc-600 mt-4">
                                By entering, you agree to our Terms of Service and Privacy Policy.
                                Access to this site is restricted to adults of legal age.
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
                  <ShieldCheck className="w-8 h-8" style={{ color: primaryColor }} />
                </div>
              )}
              <CardTitle className="text-2xl font-semibold">
                Age Verification Required
              </CardTitle>
              <CardDescription className="text-base">
                You must be at least <span className="font-bold text-foreground">{minimumAge}</span> years old to access {storeName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-8">
              <Button
                className="w-full h-12 text-lg font-medium"
                style={{ backgroundColor: primaryColor }}
                onClick={() => onVerify(true)}
              >
                I am {minimumAge}+
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 text-lg font-medium"
                onClick={handleReject}
              >
                Leave Site
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-4">
                By entering, you agree to our Terms of Service and Privacy Policy.
                Access to this site is restricted to adults of legal age.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
