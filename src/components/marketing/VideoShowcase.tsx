/**
 * VideoShowcase - Video demo section with play button overlay
 * Shows a preview thumbnail with play button that opens video modal
 */

import { motion } from "framer-motion";
import { useState } from "react";
import { Play, X, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VideoShowcase() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  return (
    <section className="py-20 md:py-28 bg-[hsl(var(--marketing-bg))] relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[hsl(var(--marketing-primary))]/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]"
          >
            See It In Action
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto"
          >
            Watch how FloraIQ transforms cannabis distribution in under 2 minutes
          </motion.p>
        </div>

        {/* Video container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="max-w-5xl mx-auto"
        >
          <div className="relative rounded-3xl overflow-hidden border border-[hsl(var(--marketing-border))] shadow-2xl shadow-[hsl(var(--marketing-primary))]/10 aspect-video bg-gradient-to-br from-slate-900 to-slate-800">
            {!isPlaying ? (
              // Thumbnail with play button
              <>
                {/* Mock dashboard preview as thumbnail */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                  {/* Fake dashboard elements */}
                  <div className="absolute inset-4 md:inset-8 grid grid-cols-3 gap-4 opacity-30">
                    <div className="col-span-2 bg-white/10 rounded-xl" />
                    <div className="bg-white/10 rounded-xl" />
                    <div className="bg-white/10 rounded-xl" />
                    <div className="col-span-2 bg-white/10 rounded-xl" />
                  </div>
                  
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>

                {/* Play button */}
                <motion.button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.div
                    className="relative"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {/* Glow ring */}
                    <div className="absolute inset-0 rounded-full bg-[hsl(var(--marketing-primary))] blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                    
                    {/* Play button */}
                    <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-[hsl(var(--marketing-primary))] flex items-center justify-center shadow-lg group-hover:shadow-[hsl(var(--marketing-primary))]/50 transition-shadow">
                      <Play className="w-8 h-8 md:w-10 md:h-10 text-white fill-white ml-1" />
                    </div>
                  </motion.div>
                </motion.button>

                {/* Duration badge */}
                <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm font-medium">
                  1:47
                </div>

                {/* Watch demo text */}
                <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8">
                  <p className="text-white/80 text-sm md:text-base font-medium">
                    Watch the full demo
                  </p>
                  <p className="text-white/50 text-xs md:text-sm">
                    No signup required
                  </p>
                </div>
              </>
            ) : (
              // Video player (placeholder - would be real video in production)
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                {/* Mock video content */}
                <div className="text-center text-white">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-[hsl(var(--marketing-primary))]/20 flex items-center justify-center mx-auto mb-4">
                      <Play className="w-8 h-8 text-[hsl(var(--marketing-primary))]" />
                    </div>
                    <p className="text-lg font-medium">Video Demo</p>
                    <p className="text-sm text-white/60 mt-2">
                      Connect your video hosting service to display the demo here
                    </p>
                  </motion.div>
                </div>

                {/* Close button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsPlaying(false)}
                  className="absolute top-4 right-4 text-white hover:bg-white/10"
                >
                  <X className="w-6 h-6" />
                </Button>

                {/* Mute toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMuted(!isMuted)}
                  className="absolute bottom-4 right-4 text-white hover:bg-white/10"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Feature highlights below video */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-4xl mx-auto"
        >
          {[
            { label: "Setup Time", value: "< 5 min" },
            { label: "Learning Curve", value: "Minimal" },
            { label: "Support", value: "24/7" },
            { label: "Data Migration", value: "Free" },
          ].map((item, i) => (
            <div
              key={i}
              className="text-center p-4 rounded-xl bg-[hsl(var(--marketing-bg-subtle))]/50 border border-[hsl(var(--marketing-border))]"
            >
              <div className="text-2xl font-bold text-[hsl(var(--marketing-primary))]">
                {item.value}
              </div>
              <div className="text-sm text-[hsl(var(--marketing-text-light))]">
                {item.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

