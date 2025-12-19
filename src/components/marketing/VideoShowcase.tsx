/**
 * VideoShowcase - Optimized video demo section
 * Uses CSS transitions instead of Framer Motion
 */

import { useState } from "react";
import { Play, X, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VideoShowcase() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  return (
    <section className="py-16 md:py-24 bg-[hsl(var(--marketing-bg))] relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-[hsl(var(--marketing-text))]">
            See It In Action
          </h2>
          <p className="text-lg text-[hsl(var(--marketing-text-light))] max-w-xl mx-auto">
            Watch how FloraIQ transforms cannabis distribution in under 2 minutes
          </p>
        </div>

        {/* Video container */}
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden border border-[hsl(var(--marketing-border))] shadow-xl aspect-video bg-gradient-to-br from-slate-900 to-slate-800">
            {!isPlaying ? (
              // Thumbnail with play button
              <>
                {/* Mock dashboard preview as thumbnail */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                  <div className="absolute inset-4 md:inset-8 grid grid-cols-3 gap-4 opacity-30">
                    <div className="col-span-2 bg-white/10 rounded-xl" />
                    <div className="bg-white/10 rounded-xl" />
                    <div className="bg-white/10 rounded-xl" />
                    <div className="col-span-2 bg-white/10 rounded-xl" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                </div>

                {/* Play button */}
                <button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center group cursor-pointer"
                >
                  <div className="relative">
                    {/* Glow ring */}
                    <div className="absolute inset-0 rounded-full bg-[hsl(var(--marketing-primary))] blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                    
                    {/* Play button */}
                    <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full bg-[hsl(var(--marketing-primary))] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200">
                      <Play className="w-6 h-6 md:w-8 md:h-8 text-white fill-white ml-1" />
                    </div>
                  </div>
                </button>

                {/* Duration badge */}
                <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm font-medium">
                  1:47
                </div>

                {/* Watch demo text */}
                <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6">
                  <p className="text-white/80 text-sm font-medium">Watch the full demo</p>
                  <p className="text-white/50 text-xs">No signup required</p>
                </div>
              </>
            ) : (
              // Video player placeholder
              <div className="absolute inset-0 bg-black flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="w-12 h-12 rounded-full bg-[hsl(var(--marketing-primary))]/20 flex items-center justify-center mx-auto mb-4">
                    <Play className="w-6 h-6 text-[hsl(var(--marketing-primary))]" />
                  </div>
                  <p className="font-medium">Video Demo</p>
                  <p className="text-sm text-white/60 mt-1">Connect your video hosting service</p>
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
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-3xl mx-auto">
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
              <div className="text-xl md:text-2xl font-bold text-[hsl(var(--marketing-primary))]">
                {item.value}
              </div>
              <div className="text-sm text-[hsl(var(--marketing-text-light))]">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
