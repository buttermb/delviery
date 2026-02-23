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
    <div className="container mx-auto px-4 relative z-10">
      {/* Section header */}
      <div className="text-center mb-16">
        {/* ... */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold mb-6">
          <Star className="w-4 h-4 fill-emerald-600 text-emerald-600" />
          <span>Trusted by 1,200+ Cannabis Businesses</span>
        </div>

        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
          Loved by Industry Leaders
        </h2>

        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          See why top cannabis distributors choose FloraIQ
        </p>
      </div>

      {/* Testimonial carousel */}
      <div className="max-w-4xl mx-auto" role="region" aria-label="Customer testimonials" aria-roledescription="carousel">
        <div className="relative min-h-[380px] md:min-h-[320px]" aria-live="polite" aria-atomic="true">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className={`absolute inset-0 transition-all duration-500 ease-out ${index === activeIndex
                ? 'opacity-100 translate-x-0 scale-100'
                : index < activeIndex
                  ? 'opacity-0 -translate-x-8 scale-95 pointer-events-none'
                  : 'opacity-0 translate-x-8 scale-95 pointer-events-none'
                }`}
            >
              <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12 shadow-xl h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Quote className="w-24 h-24 text-emerald-800" />
                </div>

                {/* Content */}
                <p className="text-xl md:text-2xl text-slate-800 leading-relaxed mb-8 relative z-10 font-medium">
                  "{testimonial.content}"
                </p>

                {/* Highlight badge */}
                {testimonial.highlight && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-bold mb-6 border border-emerald-100">
                    <Star className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                    {testimonial.highlight}
                  </div>
                )}

                {/* Author */}
                <div className="flex items-center gap-4 border-t border-gray-100 pt-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border border-emerald-200">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">
                      {testimonial.name}
                    </div>
                    <div className="text-slate-500 text-sm">
                      {testimonial.role} at {testimonial.company}
                    </div>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-emerald-500 fill-current" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-4 mt-12">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrev}
            className="rounded-full border-gray-200 hover:bg-white hover:border-emerald-300 hover:text-emerald-700 hover:shadow-md transition-all"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </Button>

          {/* Dots */}
          <div className="flex gap-2" role="tablist" aria-label="Testimonial navigation">
            {testimonials.map((t, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                role="tab"
                aria-selected={index === activeIndex}
                aria-label={`Testimonial ${index + 1} of ${testimonials.length}: ${t.name}`}
                className={`rounded-full transition-all duration-300 h-2 block ${index === activeIndex
                  ? "w-8 bg-emerald-600"
                  : "w-2 bg-gray-300 hover:bg-emerald-300"
                  }`}
              />
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="rounded-full border-gray-200 hover:bg-white hover:border-emerald-300 hover:text-emerald-700 hover:shadow-md transition-all"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Trust indicators */}
      <div className="flex flex-wrap justify-center gap-8 mt-16 text-slate-500">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3">
            {["MJ", "SC", "DR", "JW"].map((initials, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold border-2 border-white"
              >
                {initials}
              </div>
            ))}
          </div>
          <span className="text-sm font-medium">Join 1,200+ customers</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 text-emerald-500 fill-current" />
            ))}
          </div>
          <span className="text-sm font-medium">4.9/5 average rating</span>
        </div>
      </div>
    </div>
  );
}
