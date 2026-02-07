/**
 * TestimonialsCarousel - Optimized social proof section
 * Uses CSS transitions instead of Framer Motion for better scroll performance
 */

import { useState, useEffect, useCallback } from "react";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Testimonial {
  id: number;
  name: string;
  role: string;
  company: string;
  avatar: string;
  content: string;
  rating: number;
  highlight?: string;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Marcus Johnson",
    role: "Operations Director",
    company: "GreenLeaf Distributors",
    avatar: "MJ",
    content: "FloraIQ transformed our entire operation. We went from managing spreadsheets to having real-time visibility across 12 locations. The disposable menus feature alone saved us 20+ hours per week.",
    rating: 5,
    highlight: "20+ hours saved weekly"
  },
  {
    id: 2,
    name: "Sarah Chen",
    role: "CEO",
    company: "Pacific Coast Cannabis",
    avatar: "SC",
    content: "The security features are unmatched. Our clients love the auto-expiring catalogs - they feel confident knowing their orders are protected. Revenue is up 40% since switching.",
    rating: 5,
    highlight: "40% revenue increase"
  },
  {
    id: 3,
    name: "David Rodriguez",
    role: "Founder",
    company: "Mile High Supply Co",
    avatar: "DR",
    content: "Best decision we made this year. The fleet management and live tracking eliminated our delivery disputes completely. Customer satisfaction scores are at an all-time high.",
    rating: 5,
    highlight: "Zero delivery disputes"
  },
  {
    id: 4,
    name: "Jennifer Williams",
    role: "COO",
    company: "Emerald Valley Wholesale",
    avatar: "JW",
    content: "We evaluated 8 different platforms before choosing FloraIQ. The white-label customer portal and compliance features put them miles ahead.",
    rating: 5,
    highlight: "White-label excellence"
  },
  {
    id: 5,
    name: "Michael Torres",
    role: "Head of Logistics",
    company: "SunState Distribution",
    avatar: "MT",
    content: "The route optimization alone pays for the entire subscription. We're delivering 30% more orders with the same fleet. The ROI was visible within the first month.",
    rating: 5,
    highlight: "30% more deliveries"
  }
];

export function TestimonialsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  }, []);

  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(goToNext, 6000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, goToNext]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    goToPrev();
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    goToNext();
  };

  const handleDotClick = (index: number) => {
    setIsAutoPlaying(false);
    setActiveIndex(index);
  };

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

        {/* Testimonial carousel - CSS transitions only */}
        <div className="max-w-4xl mx-auto">
          <div className="relative min-h-[380px] md:min-h-[320px]">
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.id}
                className={`absolute inset-0 transition-all duration-500 ease-out ${
                  index === activeIndex 
                    ? 'opacity-100 translate-x-0 scale-100' 
                    : index < activeIndex 
                      ? 'opacity-0 -translate-x-8 scale-95 pointer-events-none'
                      : 'opacity-0 translate-x-8 scale-95 pointer-events-none'
                }`}
              >
                <div className="bg-[hsl(var(--marketing-bg))]/80 backdrop-blur-sm rounded-3xl border border-[hsl(var(--marketing-border))] p-8 md:p-12 shadow-xl h-full">
                  {/* Quote icon */}
                  <Quote className="w-10 h-10 text-[hsl(var(--marketing-primary))]/20 mb-4" />
                  
                  {/* Content */}
                  <p className="text-lg md:text-xl text-[hsl(var(--marketing-text))] leading-relaxed mb-6">
                    "{testimonial.content}"
                  </p>

                  {/* Highlight badge */}
                  {testimonial.highlight && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] text-sm font-bold mb-6">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {testimonial.highlight}
                    </div>
                  )}

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center text-white font-bold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-[hsl(var(--marketing-text))]">
                        {testimonial.name}
                      </div>
                      <div className="text-[hsl(var(--marketing-text-light))] text-sm">
                        {testimonial.role} at {testimonial.company}
                      </div>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              className="rounded-full border-[hsl(var(--marketing-border))] hover:bg-[hsl(var(--marketing-primary))]/10 hover:border-[hsl(var(--marketing-primary))]"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            {/* Dots */}
            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? "w-8 bg-[hsl(var(--marketing-primary))]"
                      : "w-2 bg-[hsl(var(--marketing-border))] hover:bg-[hsl(var(--marketing-text-light))]"
                  }`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="rounded-full border-[hsl(var(--marketing-border))] hover:bg-[hsl(var(--marketing-primary))]/10 hover:border-[hsl(var(--marketing-primary))]"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-8 mt-12 text-[hsl(var(--marketing-text-light))]">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {["MJ", "SC", "DR", "JW"].map((initials, i) => (
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
