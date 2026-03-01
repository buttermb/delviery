import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, Sparkles } from 'lucide-react';
import { useState } from 'react';

export interface NewsletterSectionProps {
    content: {
        heading: string;
        subheading: string;
        button_text: string;
        placeholder_text: string;
        success_message: string;
    };
    styles: {
        background_gradient_start: string;
        background_gradient_end: string;
        text_color: string;
        accent_color: string;
        button_color: string;
    };
}

export function NewsletterSection({ content, styles }: NewsletterSectionProps) {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const {
        heading = "Stay in the Loop",
        subheading = "Subscribe for exclusive drops, deals, and updates.",
        button_text = "Subscribe",
        placeholder_text = "Enter your email",
        success_message = "Thanks for subscribing!"
    } = content || {};

    const {
        background_gradient_start = "#000000",
        background_gradient_end = "#1f2937",
        text_color = "#ffffff",
        accent_color = "#10b981",
        button_color = "#10b981"
    } = styles || {};

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            setSubmitted(true);
            // In production, this would call an API
        }
    };

    return (
        <section 
            className="py-24 px-4 sm:px-6 relative overflow-hidden"
            style={{ 
                backgroundImage: `linear-gradient(135deg, ${background_gradient_start}, ${background_gradient_end})`
            }}
        >
            {/* Decorative elements */}
            <div 
                className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-10"
                style={{ backgroundColor: accent_color }}
            />
            <div 
                className="absolute bottom-0 left-0 w-64 h-64 rounded-full blur-3xl opacity-10"
                style={{ backgroundColor: accent_color }}
            />

            <div className="max-w-2xl mx-auto relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center"
                >
                    <Sparkles className="w-8 h-8 mx-auto mb-6" style={{ color: accent_color }} />
                    
                    <h2 
                        className="text-3xl md:text-4xl font-light mb-4"
                        style={{ color: text_color }}
                    >
                        {heading}
                    </h2>
                    
                    <p 
                        className="text-lg mb-8 opacity-80"
                        style={{ color: text_color }}
                    >
                        {subheading}
                    </p>

                    {!submitted ? (
                        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                            <Label htmlFor="newsletter-email" className="sr-only">Email address</Label>
                            <Input
                                id="newsletter-email"
                                type="email"
                                placeholder={placeholder_text}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="flex-1 h-12 px-4 rounded-full border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/50"
                                required
                            />
                            <Button
                                type="submit"
                                className="h-12 px-8 rounded-full font-medium text-black"
                                style={{ backgroundColor: button_color }}
                            >
                                <Send className="w-4 h-4 mr-2" />
                                {button_text}
                            </Button>
                        </form>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center justify-center gap-2 text-lg"
                            style={{ color: accent_color }}
                        >
                            <Sparkles className="w-5 h-5" />
                            {success_message}
                        </motion.div>
                    )}

                    <p 
                        className="text-xs mt-4 opacity-50"
                        style={{ color: text_color }}
                    >
                        No spam. Unsubscribe anytime.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
