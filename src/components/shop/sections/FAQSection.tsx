import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export interface FAQSectionProps {
    content: {
        heading: string;
        subheading: string;
        faqs?: Array<{
            question: string;
            answer: string;
        }>;
    };
    styles: {
        background_color: string;
        text_color: string;
        accent_color: string;
        border_color: string;
    };
}

const defaultFAQs = [
    {
        question: "What are your delivery hours?",
        answer: "We deliver 7 days a week from 10 AM to 10 PM. Same-day delivery is available for orders placed before 6 PM."
    },
    {
        question: "How do I track my order?",
        answer: "Once your order is dispatched, you'll receive a tracking link via SMS and email. You can also track in real-time through your account dashboard."
    },
    {
        question: "What payment methods do you accept?",
        answer: "We accept cash on delivery, debit cards, and all major credit cards. Digital wallet options are also available."
    },
    {
        question: "Is there a minimum order amount?",
        answer: "Yes, the minimum order amount is $50 for delivery. Orders above $100 qualify for free delivery."
    },
    {
        question: "What's your return policy?",
        answer: "We stand behind our products. If you're not satisfied, contact us within 24 hours of delivery for a full refund or exchange."
    }
];

export function FAQSection({ content, styles }: FAQSectionProps) {
    const {
        heading = "Frequently Asked Questions",
        subheading = "Got questions? We've got answers.",
        faqs: rawFaqs,
    } = content || {};

    const faqs = rawFaqs && rawFaqs.length > 0 ? rawFaqs : defaultFAQs;

    const {
        background_color = "#f9fafb",
        text_color = "#000000",
        accent_color = "#10b981",
        border_color = "#e5e7eb"
    } = styles || {};

    return (
        <section className="py-24 px-6" style={{ backgroundColor: background_color }}>
            <div className="max-w-3xl mx-auto">
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
                    <h2 className="text-4xl md:text-5xl font-light" style={{ color: text_color }}>
                        {heading}
                    </h2>
                </motion.div>

                {/* FAQ Accordion */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                >
                    <Accordion type="single" collapsible className="space-y-4">
                        {faqs.map((faq, index) => (
                            <AccordionItem
                                key={`faq-${faq.question}-${index}`}
                                value={`item-${index}`}
                                className="border rounded-xl px-6"
                                style={{ borderColor: border_color }}
                            >
                                <AccordionTrigger 
                                    className="text-left text-lg font-medium py-6 hover:no-underline"
                                    style={{ color: text_color }}
                                >
                                    {faq.question}
                                </AccordionTrigger>
                                <AccordionContent 
                                    className="pb-6 text-base leading-relaxed"
                                    style={{ color: `${text_color}99` }}
                                >
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </motion.div>
            </div>
        </section>
    );
}
