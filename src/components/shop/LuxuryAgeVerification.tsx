import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';

interface LuxuryAgeVerificationProps {
  storeName?: string;
  logoUrl?: string | null;
  minimumAge?: number;
  accentColor?: string;
  onVerify: (verified: boolean) => void;
  storeId?: string;
}

export function LuxuryAgeVerification({
  storeName = "Premium Store",
  logoUrl,
  minimumAge = 21,
  accentColor = '#10b981',
  onVerify,
  storeId
}: LuxuryAgeVerificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;

  // Check if already verified
  useEffect(() => {
    if (storeId) {
      const verified = safeStorage.getItem(`${STORAGE_KEYS.AGE_VERIFIED_PREFIX}${storeId}`);
      if (verified === 'true') {
        setIsVisible(false);
        onVerifyRef.current(true);
      }
    }
  }, [storeId]);

  const handleVerify = (isOfAge: boolean) => {
    setIsExiting(true);

    setTimeout(() => {
      if (isOfAge && storeId) {
        safeStorage.setItem(`${STORAGE_KEYS.AGE_VERIFIED_PREFIX}${storeId}`, 'true');
      }
      setIsVisible(false);
      onVerify(isOfAge);
    }, 500);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isExiting ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-max bg-black flex items-center justify-center p-6"
      >
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-black via-neutral-950 to-black" />
          <motion.div
            initial={{ opacity: 0.05 }}
            animate={{
              opacity: [0.05, 0.1, 0.05],
              scale: [1, 1.05, 1]
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-3xl"
            style={{ backgroundColor: accentColor }}
          />
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{
            opacity: isExiting ? 0 : 1,
            scale: isExiting ? 0.95 : 1,
            y: isExiting ? 20 : 0
          }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md"
        >
          <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-3xl p-10 text-center" data-testid="age-verification-modal">
            {/* Logo or Icon */}
            <div className="mb-8 flex justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={storeName}
                  className="h-16 object-contain"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}30 0%, ${accentColor}10 100%)`
                  }}
                >
                  <Shield className="w-10 h-10" style={{ color: accentColor }} />
                </div>
              )}
            </div>

            {/* Title */}
            <h1 className="text-white text-2xl font-extralight tracking-tight mb-2">
              Age Verification
            </h1>
            <p className="text-white/40 text-sm font-light mb-8">
              You must be {minimumAge}+ to enter {storeName}
            </p>

            {/* Divider */}
            <div className="w-16 h-[1px] bg-white/10 mx-auto mb-8" />

            {/* Question */}
            <p className="text-white/60 text-lg font-light mb-8">
              Are you {minimumAge} years or older?
            </p>

            {/* Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={() => handleVerify(false)}
                variant="outline"
                className="flex-1 h-14 text-white border-white/10 hover:border-white/30 hover:bg-white/5 rounded-full font-light"
              >
                No, I'm not
              </Button>
              <Button
                onClick={() => handleVerify(true)}
                className="flex-1 h-14 bg-white text-black hover:bg-white/90 rounded-full font-light"
              >
                Yes, I am
              </Button>
            </div>

            {/* Legal text */}
            <p className="text-white/20 text-xs font-light mt-8 leading-relaxed">
              By entering this site, you confirm that you are of legal age to consume cannabis in your jurisdiction.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
