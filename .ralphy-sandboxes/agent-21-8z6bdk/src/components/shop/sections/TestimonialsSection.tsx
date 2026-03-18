import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

export interface TestimonialsSectionProps {
    content: {
        heading: string;
        subheading: string;
        testimonials?: Array<{
            name: string;
            role: string;
            quote: string;
            rating: number;
        }>;
    };
    styles: {
        background_color: string;
        text_color: string;
        accent_color: string;
        card_background: string;
    };
}

const defaultTestimonials = [
    {
        name: "Sarah M.",
        role: "Verified Customer",
        quote: "The quality is unmatched. Fast delivery and exactly what I was looking for.",
        rating: 5
    },
    {
        name: "Michael R.",
        role: "Regular Customer",
        quote: "Best service in the city. Professional, discreet, and always reliable.",
        rating: 5
    },
    {
        name: "Jessica L.",
        role: "New Customer",
        quote: "Impressed with the selection and the speed of delivery. Highly recommend!",
        rating: 5
    }
];

export function TestimonialsSection({ content, styles }: TestimonialsSectionProps) {
    const {
        heading = "What Our Customers Say",
        subheading = "Join thousands of satisfied customers",
        testimonials: rawTestimonials,
    } = content || {};

    const testimonials = rawTestimonials && rawTestimonials.length > 0 ? rawTestimonials : defaultTestimonials;

    const {
        background_color = "#ffffff",
        text_color = "#000000",
        accent_color = "#10b981",
        card_background = "#f9fafb"
    } = styles || {};

    return (
        <section className="py-24 px-4 sm:px-6" style={{ backgroundColor: background_color }}>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <p className="text-sm uppercase tracking-widest mb-4" style={{ color: accent_color }}>
                        {subheading}
                    </p>
                    <h2 className="text-2xl sm:text-4xl md:text-5xl font-light break-words" style={{ color: text_color }}>
                        {heading}
                    </h2>
                </motion.div>

                {/* Testimonials Grid */}
                <div className="grid md:grid-cols-3 gap-6">
                    {testimonials.map((testimonial, index) => (
                        <motion.div
                            key={`${testimonial.name}-${testimonial.role}-${index}`}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="p-8 rounded-2xl relative"
                            style={{ backgroundColor: card_background }}
                        >
                            <Quote 
                                className="absolute top-6 right-6 w-8 h-8 opacity-10" 
                                style={{ color: accent_color }}
                            />
                            
                            {/* Rating */}
                            <div className="flex gap-1 mb-4">
                                {[...Array(5)].map((_, i) => (
                                    <Star
                                        key={i}
                                        className="w-4 h-4"
                                        fill={i < testimonial.rating ? accent_color : 'transparent'}
                                        stroke={accent_color}
                                    />
                                ))}
                            </div>

                            {/* Quote */}
                            <p 
                                className="text-base leading-relaxed mb-6"
                                style={{ color: `${text_color}cc` }}
                            >
                                "{testimonial.quote}"
                            </p>

                            {/* Author */}
                            <div>
                                <p className="font-medium" style={{ color: text_color }}>
                                    {testimonial.name}
                                </p>
                                <p className="text-sm opacity-60" style={{ color: text_color }}>
                                    {testimonial.role}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
