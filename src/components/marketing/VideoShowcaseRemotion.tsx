/**
 * VideoShowcaseRemotion — 30-second FloraIQ promo video
 * with section heading and feature pills.
 *
 * Uses pre-rendered MP4 from public/videos/floraiq-promo.mp4
 * (render with: npx remotion render src/remotion/render-entry.tsx FloraIQPromo public/videos/floraiq-promo.mp4)
 */

const FEATURE_PILLS = [
  'Dashboard Analytics',
  'Order Pipeline',
  'Inventory Sync',
  'Encrypted Menus',
  'Payment Processing',
];

export function VideoShowcaseRemotion() {
  return (
    <section
      id="video-showcase-section"
      className="py-20 md:py-32 bg-[hsl(var(--marketing-bg))] relative overflow-x-hidden"
    >
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[hsl(var(--marketing-primary))]/5 border border-[hsl(var(--marketing-primary))]/10 text-[10px] font-bold text-[hsl(var(--marketing-primary))] mb-6 backdrop-blur-sm uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            30-Second Walkthrough
          </div>
          <h2 className="text-4xl md:text-6xl font-bold mb-4 text-[hsl(var(--marketing-text))] tracking-tight">
            See the platform in action
          </h2>
          <p className="text-lg text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto font-light">
            Watch how a menu gets created, shared, ordered from, and destroyed — all in 30 seconds.
          </p>
        </div>

        {/* Promo Video */}
        <div className="max-w-[1200px] mx-auto rounded-3xl border border-slate-200 shadow-2xl overflow-hidden bg-black">
          <video
            controls
            playsInline
            preload="metadata"
            poster="/videos/floraiq-promo-poster.jpg"
            className="w-full aspect-video"
          >
            <source src="/videos/floraiq-promo.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-10">
          {FEATURE_PILLS.map((pill) => (
            <span
              key={pill}
              className="px-4 py-2 rounded-full bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))] text-sm font-medium text-[hsl(var(--marketing-text))]"
            >
              {pill}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
