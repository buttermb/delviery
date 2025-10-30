import CustomerLayout from '@/layouts/CustomerLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const FAQ = () => {
  const faqs = [
    {
      question: "Are your products legal?",
      answer:
        "Yes. All products are derived from hemp and contain less than 0.3% Delta-9 THC, complying with federal and New York State regulations. We are a licensed cannabinoid hemp retailer by the NY Office of Cannabis Management.",
    },
    {
      question: "Are your products lab tested?",
      answer:
        "Yes. Every product is third-party lab tested for potency, purity, pesticides, heavy metals, and contaminants. Certificates of Analysis (COAs) are available for all products on request.",
    },
    {
      question: "What areas do you deliver to?",
      answer:
        "We deliver across Manhattan, Brooklyn, and Queens. Enter your address at checkout to confirm delivery availability. Orders placed before 6 PM typically arrive same day.",
    },
    {
      question: "How fast is delivery?",
      answer:
        "Orders typically arrive within 30-45 minutes. Delivery windows are 2-4 hours. You'll receive real-time updates on your order status.",
    },
    {
      question: "Do you require ID?",
      answer:
        "Yes. You must be 21+ with valid government ID. Our driver will verify your age at delivery. Acceptable IDs: driver's license, state ID, passport, or military ID.",
    },
    {
      question: "What are the delivery fees?",
      answer:
        "FREE on orders over $100. $10 for orders $50-$99. $15 for orders under $50. All fees displayed at checkout.",
    },
    {
      question: "What should I expect in terms of effects?",
      answer:
        "Products may produce various effects depending on the strain and product type. Sativas tend to be energizing, indicas relaxing, and hybrids balanced. Effects vary by individual. Start with small amounts and use responsibly.",
    },
    {
      question: "Will these products show up on a drug test?",
      answer:
        "Yes. Products may result in positive drug test results. If you're subject to drug testing, consult with your employer or testing authority before purchasing.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept cash on delivery. Have cash ready when the driver arrives. Additional payment options coming soon.",
    },
    {
      question: "What is your return policy?",
      answer:
        "Contact support immediately if you receive a damaged or incorrect product. Include your order number and photos. We'll work with you to resolve any issues.",
    },
    {
      question: "How do I contact customer support?",
      answer:
        "Email us at support@newyorkminutenyc.com or use the contact form on our Support page. We typically respond within 24 hours.",
    },
  ];

  return (
    <CustomerLayout>
      <section className="py-32 bg-black relative overflow-hidden">
        
        {/* Background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-20">
            <div className="inline-block px-4 py-1.5 mb-6 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-full">
              <span className="text-[10px] text-white/50 font-light tracking-[0.2em] uppercase">
                Get Answers
              </span>
            </div>
            
            <h1 className="text-white font-light text-6xl md:text-7xl tracking-tight mb-6">
              Frequently Asked Questions
            </h1>
            
            <p className="text-white/40 text-xl font-light leading-relaxed">
              Everything you need to know about premium flower delivery in NYC
            </p>
          </div>
          
          {/* FAQs */}
          <div className="max-w-3xl mx-auto mb-16">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-xl px-6 hover:border-white/10 transition-colors"
                >
                  <AccordionTrigger className="text-left hover:no-underline py-6">
                    <span className="text-white font-light text-lg">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-white/60 text-sm font-light leading-relaxed pb-6">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          
          {/* CTA */}
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
              <h3 className="text-white text-xl font-light mb-2">Still have questions?</h3>
              <p className="text-white/40 text-sm font-light mb-6">
                Our support team is here to help
              </p>
              <Button
                asChild
                className="bg-emerald-500 text-black hover:bg-emerald-400 font-light"
              >
                <a href="/support">Contact Support</a>
              </Button>
            </div>
          </div>
          
        </div>
        
      </section>
    </CustomerLayout>
  );
};

export default FAQ;
