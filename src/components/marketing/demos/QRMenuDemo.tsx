import { motion } from 'framer-motion';
import { Lock, QrCode, Clock } from 'lucide-react';

export function QRMenuDemo() {
  return (
    <div className="w-full h-full bg-card/50 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Lock className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-foreground">Disposable Menu Generator</h4>
      </div>

      <div className="space-y-6">
        {/* QR Code Mockup */}
        <motion.div
          className="bg-white p-6 rounded-lg mx-auto w-fit"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', duration: 0.8 }}
        >
          <div className="w-32 h-32 bg-gradient-to-br from-primary to-accent flex items-center justify-center rounded-lg">
            <QrCode className="h-20 w-20 text-white" />
          </div>
        </motion.div>

        {/* Settings */}
        <div className="space-y-3">
          <motion.div
            className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">Expires in</span>
            </div>
            <span className="text-sm font-bold text-accent">24 hours</span>
          </motion.div>

          <motion.div
            className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">Encryption</span>
            </div>
            <span className="text-sm font-bold text-green-500">256-bit</span>
          </motion.div>

          <motion.div
            className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <span className="text-sm text-foreground">Views</span>
            <span className="text-sm font-bold text-primary">1 / 1</span>
          </motion.div>
        </div>

        <motion.div
          className="p-4 bg-accent/10 rounded-lg border border-accent/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <div className="text-sm text-foreground font-medium">🔥 Burns After Reading</div>
          <div className="text-xs text-muted-foreground mt-1">Menu auto-deletes after viewing</div>
        </motion.div>
      </div>
    </div>
  );
}
