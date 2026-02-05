/**
 * VideoShowcaseRemotion — 30-second FloraIQ promo video section.
 *
 * Features:
 * - Dual format: WebM (smaller) with MP4 fallback
 * - Autoplay on scroll via IntersectionObserver
 * - Poster image for instant visual before load
 * - Reduced-motion support (shows poster only)
 * - Lazy loading — video only loads when near viewport
 * - Mobile-optimized with responsive padding
 *
 * Render commands:
 *   npx remotion render src/remotion/Root.tsx ProductDemo public/videos/floraiq-promo.mp4
 *   npx remotion render src/remotion/Root.tsx ProductDemo public/videos/floraiq-promo.webm --codec=vp8
 *
 * Optional compression (after render):
 *   ffmpeg -i public/videos/floraiq-promo.mp4 -c:v libx264 -crf 23 -preset slow -an public/videos/floraiq-promo-compressed.mp4
 */

import { useRef, useEffect, useState, useCallback } from 'react';

const FEATURE_PILLS = [
  'Dashboard Analytics',
  'Order Pipeline',
  'Inventory AI',
  'Fleet Tracking',
  'Encrypted Menus',
] as const;

export function VideoShowcaseRemotion() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check reduced motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Autoplay when section scrolls into view, pause when it leaves
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      setIsVisible(entry.isIntersecting);

      if (!videoRef.current || prefersReducedMotion) return;

      if (entry.isIntersecting) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {
          // Autoplay blocked — that's fine, user can click
        });
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    },
    [prefersReducedMotion],
  );

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.3, // Trigger when 30% visible
      rootMargin: '100px', // Start loading slightly before visible
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersection]);

  // Manual play/pause toggle
  const togglePlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      className="py-16 md:py-24 bg-[hsl(var(--marketing-bg))] relative overflow-hidden"
    >
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[hsl(var(--marketing-primary))]/5 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(var(--marketing-primary))]/10 border border-[hsl(var(--marketing-primary))]/20 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-primary))] animate-pulse" />
            <span className="text-xs font-semibold text-[hsl(var(--marketing-primary))] tracking-wide uppercase">
              Product Tour
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))] tracking-tight">
            See FloraIQ in Action
          </h2>
          <p className="text-lg text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto">
            30 seconds. 5 features. Everything you need to run wholesale ops from one dashboard.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {FEATURE_PILLS.map((pill) => (
            <span
              key={pill}
              className="px-4 py-1.5 rounded-full text-xs font-medium bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text-light))]"
            >
              {pill}
            </span>
          ))}
        </div>

        {/* Video container */}
        <div className="max-w-5xl mx-auto">
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl border border-[hsl(var(--marketing-border))] bg-slate-900 group cursor-pointer"
            onClick={togglePlayback}
            role="button"
            tabIndex={0}
            aria-label={isPlaying ? 'Pause video' : 'Play video'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                togglePlayback();
              }
            }}
          >
            {/* Aspect ratio wrapper — 16:9 */}
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              {hasError || prefersReducedMotion ? (
                /* Fallback: static poster with play prompt */
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                  <div className="w-20 h-20 rounded-full bg-[hsl(var(--marketing-primary))]/20 flex items-center justify-center mb-4 border border-[hsl(var(--marketing-primary))]/30">
                    <svg className="w-8 h-8 text-[hsl(var(--marketing-primary))] ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-400">
                    {prefersReducedMotion ? 'Motion reduced — click to play' : 'Video unavailable'}
                  </p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  loop
                  playsInline
                  preload={isVisible ? 'auto' : 'none'}
                  poster="/videos/floraiq-poster.webp"
                  onError={() => setHasError(true)}
                >
                  {/* WebM first — smaller file, better compression */}
                  <source src="/videos/floraiq-promo.webm" type="video/webm" />
                  {/* MP4 fallback — universal support */}
                  <source src="/videos/floraiq-promo.mp4" type="video/mp4" />
                </video>
              )}

              {/* Play/Pause overlay */}
              {!hasError && !prefersReducedMotion && (
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                    isPlaying
                      ? 'opacity-0 group-hover:opacity-100'
                      : 'opacity-100'
                  }`}
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/10 transition-transform group-hover:scale-110">
                    {isPlaying ? (
                      <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                      </svg>
                    ) : (
                      <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom gradient for polish */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Caption below video */}
          <p className="text-center text-xs text-[hsl(var(--marketing-text-light))]/60 mt-4">
            Rendered with Remotion &bull; 1920&times;1080 @ 30fps
          </p>
        </div>
      </div>
    </section>
  );
}
