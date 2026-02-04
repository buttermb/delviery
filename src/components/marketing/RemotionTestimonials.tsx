/**
 * RemotionTestimonials — Section that renders multiple Remotion testimonial cards.
 * Auto-advances between testimonials. Keeps existing data from TestimonialsCarousel.
 */

import { useState, useEffect, useCallback } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RemotionPlayer } from '@/components/remotion/RemotionPlayer';
import { TestimonialCard } from '@/remotion/compositions/TestimonialCard/index';
import { SCENE_DURATIONS } from '@/remotion/config';

interface TestimonialData {
  id: number;
  name: string;
  role: string;
  company: string;
  avatar: string;
  content: string;
  rating: number;
  highlight?: string;
}

const testimonials: TestimonialData[] = [
  {
    id: 1,
    name: 'Marcus J.',
    role: 'Ops Director',
    company: 'GreenLeaf Distro',
    avatar: 'MJ',
    content: "We were drowning in spreadsheets. FloraIQ's Metrc sync alone saved us ~15 hours/week of manual data entry. The automated manifests are bulletproof.",
    rating: 5,
    highlight: '15hrs/wk saved',
  },
  {
    id: 2,
    name: 'Sarah C.',
    role: 'CEO',
    company: 'Pacific Coast',
    avatar: 'SC',
    content: 'The disposable menus are a game changer for OPSEC. We generated 847 unique catalogs last month and had zero leakage. Security is actually real here.',
    rating: 5,
    highlight: 'Zero data leaks',
  },
  {
    id: 3,
    name: 'David R.',
    role: 'Founder',
    company: 'Mile High Supply',
    avatar: 'DR',
    content: 'Dispatcher view shows me exactly where every unit is. We improved our stops-per-hour by 22% in the first month using the route optimization engine.',
    rating: 5,
    highlight: '22% efficiency gain',
  },
  {
    id: 4,
    name: 'Jen W.',
    role: 'COO',
    company: 'Emerald Valley',
    avatar: 'JW',
    content: "Finally, a platform that doesn't feel like a toy. Usage-based pricing made sense for us as we scaled from 2 to 5 hubs. The API docs are actually readable.",
    rating: 5,
    highlight: 'Clean API Docs',
  },
  {
    id: 5,
    name: 'Michael T.',
    role: 'Logistics Lead',
    company: 'SunState',
    avatar: 'MT',
    content: "I've used every 'cannabis ERP' out there. FloraIQ is the only one that doesn't crash on Friday afternoons. Uptime has been solid 99.9%.",
    rating: 5,
    highlight: '99.9% Uptime',
  },
];

export function RemotionTestimonials() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  }, []);

  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, []);

  // Auto-advance every 10s (slightly longer than 8s composition to let it finish)
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(goToNext, 10000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, goToNext]);

  const current = testimonials[activeIndex];

  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-[hsl(var(--marketing-bg))] to-[hsl(var(--marketing-bg-subtle))]/50 relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--marketing-primary))]/10 border border-[hsl(var(--marketing-primary))]/20 text-[hsl(var(--marketing-primary))] text-sm font-medium mb-6">
            <Star className="w-4 h-4 fill-current" />
            <span>Trusted by 1,200+ Cannabis Businesses</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
            Loved by Industry Leaders
          </h2>

          <p className="text-xl text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto">
            See why top cannabis distributors choose FloraIQ
          </p>
        </div>

        {/* Remotion Testimonial Player */}
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-[hsl(var(--marketing-border))] shadow-xl overflow-hidden bg-white">
            <RemotionPlayer
              key={current.id}
              component={TestimonialCard as React.ComponentType<Record<string, unknown>>}
              durationInFrames={SCENE_DURATIONS.testimonialCard}
              inputProps={{
                text: current.content,
                author: current.name,
                company: current.company,
                rating: current.rating,
                role: current.role,
                avatar: current.avatar,
              }}
            />
          </div>

          {/* Highlight badge */}
          {current.highlight && (
            <div className="text-center mt-4">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] text-sm font-bold">
                <Star className="w-3.5 h-3.5 fill-current" />
                {current.highlight}
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => { setIsAutoPlaying(false); goToPrev(); }}
            className="rounded-full border-[hsl(var(--marketing-border))] hover:bg-[hsl(var(--marketing-primary))]/10 hover:border-[hsl(var(--marketing-primary))]"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </Button>

          <div className="flex gap-2" role="tablist" aria-label="Testimonial navigation">
            {testimonials.map((t, index) => (
              <button
                key={index}
                onClick={() => { setIsAutoPlaying(false); setActiveIndex(index); }}
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Testimonial ${index + 1} of ${testimonials.length}: ${t.name}`}
                className="rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <span
                  className={`block h-2 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? 'w-8 bg-[hsl(var(--marketing-primary))]'
                      : 'w-2 bg-[hsl(var(--marketing-border))] hover:bg-[hsl(var(--marketing-text-light))]'
                  }`}
                />
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => { setIsAutoPlaying(false); goToNext(); }}
            className="rounded-full border-[hsl(var(--marketing-border))] hover:bg-[hsl(var(--marketing-primary))]/10 hover:border-[hsl(var(--marketing-primary))]"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-8 mt-12 text-[hsl(var(--marketing-text-light))]">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {['MJ', 'SC', 'DR', 'JW'].map((initials, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center text-white text-xs font-bold border-2 border-[hsl(var(--marketing-bg))]"
                >
                  {initials}
                </div>
              ))}
            </div>
            <span className="text-sm">Join 1,200+ customers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
              ))}
            </div>
            <span className="text-sm">4.9/5 rating</span>
          </div>
        </div>
      </div>
    </section>
  );
}
