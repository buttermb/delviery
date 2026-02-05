/**
 * ModernHero - Clean, static hero section
 * Dark background with hero-loop video playing behind text
 * One headline, one subheadline, two CTAs
 *
 * Video files: Render with `npx remotion render` then place at:
 *   public/videos/hero-loop.webm  (smaller, preferred)
 *   public/videos/hero-loop.mp4   (fallback)
 */

import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";

export function ModernHero() {
  return (
    <section className="relative min-h-[90vh] md:min-h-[90vh] overflow-hidden">

      {/* Background: pre-rendered hero loop video, muted + looping */}
      <div className="absolute inset-0 z-0 bg-[#0A0A0B]">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
          poster="/videos/hero-loop-poster.jpg"
        >
          <source src="/videos/hero-loop.webm" type="video/webm" />
          <source src="/videos/hero-loop.mp4" type="video/mp4" />
        </video>
      </div>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/60 via-black/40 to-black/80" />

      {/* Hero Content */}
      <div className="relative z-10 container mx-auto px-4 pt-24 md:pt-32 pb-16 md:pb-24">
        <div className="max-w-5xl mx-auto text-center">

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[5rem] font-bold tracking-tight mb-6 md:mb-8 text-white leading-[1.1] max-w-4xl mx-auto">
            Wholesale menus that disappear after your buyers order.
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl lg:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-8 md:mb-10 px-4 md:px-0">
            Create encrypted, disposable catalogs. Accept orders. Sync inventory. All from one dashboard — free to start.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center px-4 md:px-0">
            <Link to="/signup?plan=free&flow=menu" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-10 text-base md:text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                Create Your First Menu
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>

            <Link to="/menu/example" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-10 text-base md:text-lg font-bold border-2 border-white/20 text-white hover:bg-white/10 hover:border-white/40 rounded-lg transition-all duration-300"
              >
                See a live demo menu →
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
