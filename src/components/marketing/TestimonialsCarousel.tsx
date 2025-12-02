/**
 * TestimonialsCarousel - Social proof section with customer testimonials
 * Features auto-rotating cards with ratings and company logos
 */

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
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
    content: "We evaluated 8 different platforms before choosing FloraIQ. The white-label customer portal and compliance features put them miles ahead. Our clients think it's our own software!",
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
  const [direction, setDirection] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-rotate testimonials
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handlePrev = () => {
    setIsAutoPlaying(false);
    setDirection(-1);
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-[hsl(var(--marketing-bg))] to-[hsl(var(--marketing-bg-subtle))]/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-[hsl(var(--marketing-primary))]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(var(--marketing-accent))]/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--marketing-primary))]/10 border border-[hsl(var(--marketing-primary))]/20 text-[hsl(var(--marketing-primary))] text-sm font-medium mb-6"
          >
            <Star className="w-4 h-4 fill-current" />
            <span>Trusted by 1,200+ Cannabis Businesses</span>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]"
          >
            Loved by Industry Leaders
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-[hsl(var(--marketing-text-light))] max-w-2xl mx-auto"
          >
            See why top cannabis distributors choose FloraIQ
          </motion.p>
        </div>

        {/* Testimonial carousel */}
        <div className="max-w-4xl mx-auto">
          <div className="relative min-h-[400px] md:min-h-[350px]">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={activeIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                className="absolute inset-0"
              >
                <div className="bg-[hsl(var(--marketing-bg))]/80 backdrop-blur-xl rounded-3xl border border-[hsl(var(--marketing-border))] p-8 md:p-12 shadow-2xl">
                  {/* Quote icon */}
                  <Quote className="w-12 h-12 text-[hsl(var(--marketing-primary))]/20 mb-6" />
                  
                  {/* Content */}
                  <p className="text-xl md:text-2xl text-[hsl(var(--marketing-text))] leading-relaxed mb-8 font-light">
                    "{testimonials[activeIndex].content}"
                  </p>

                  {/* Highlight badge */}
                  {testimonials[activeIndex].highlight && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--marketing-primary))]/10 text-[hsl(var(--marketing-primary))] text-sm font-bold mb-8">
                      <Star className="w-4 h-4 fill-current" />
                      {testimonials[activeIndex].highlight}
                    </div>
                  )}

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center text-white font-bold text-lg">
                      {testimonials[activeIndex].avatar}
                    </div>
                    <div>
                      <div className="font-bold text-[hsl(var(--marketing-text))]">
                        {testimonials[activeIndex].name}
                      </div>
                      <div className="text-[hsl(var(--marketing-text-light))] text-sm">
                        {testimonials[activeIndex].role} at {testimonials[activeIndex].company}
                      </div>
                    </div>
                    <div className="ml-auto flex gap-1">
                      {[...Array(testimonials[activeIndex].rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 text-yellow-500 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
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
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setDirection(index > activeIndex ? 1 : -1);
                    setActiveIndex(index);
                  }}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? "w-8 bg-[hsl(var(--marketing-primary))]"
                      : "bg-[hsl(var(--marketing-border))] hover:bg-[hsl(var(--marketing-text-light))]"
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-8 mt-16 text-[hsl(var(--marketing-text-light))]"
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {["MJ", "SC", "DR", "JW"].map((initials, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center text-white text-xs font-bold border-2 border-[hsl(var(--marketing-bg))]"
                >
                  {initials}
                </div>
              ))}
            </div>
            <span className="text-sm">Join 1,200+ happy customers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-500 fill-current" />
              ))}
            </div>
            <span className="text-sm">4.9/5 average rating</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

