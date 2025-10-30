import { useState } from "react";
import CustomerLayout from '@/layouts/CustomerLayout';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LiveChatWidget } from "@/components/LiveChatWidget";

const Support = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    orderNumber: "",
    message: "",
  });
  const [showChat, setShowChat] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would send to a support system
    toast.success("Message sent! We'll respond within 24 hours.");
    setFormData({ name: "", email: "", orderNumber: "", message: "" });
  };

  const faqs = [
    {
      question: "What are your delivery hours?",
      answer: "We deliver daily from 11 AM to 9 PM. Orders placed before 8 PM typically arrive within 60 minutes."
    },
    {
      question: "What areas do you serve?",
      answer: "We currently deliver throughout Manhattan, Brooklyn, and Queens. Enter your address at checkout to confirm availability."
    },
    {
      question: "How do I track my order?",
      answer: "After placing your order, you'll receive a tracking link via email and SMS. You can also track on our Track Order page using your order number."
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards, debit cards, and digital payment methods. Cash payment available at delivery."
    }
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
                We're Here to Help
              </span>
            </div>
            
            <h1 className="text-white font-light text-6xl md:text-7xl tracking-tight mb-6">
              Support
            </h1>
            
            <p className="text-white/40 text-xl font-light leading-relaxed">
              Get answers to common questions or reach out to our team
            </p>
          </div>
          
          {/* Contact Cards */}
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6 mb-20">
            
            {/* Phone */}
            <a 
              href="tel:212-555-DASH"
              className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8 hover:border-emerald-500/30 transition-colors group"
            >
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-white text-lg font-light mb-2">Phone</h3>
              <p className="text-white/60 text-sm font-light">(212) 555-DASH</p>
            </a>
            
            {/* Email */}
            <a 
              href="mailto:support@nym.nyc"
              className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8 hover:border-emerald-500/30 transition-colors group"
            >
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-white text-lg font-light mb-2">Email</h3>
              <p className="text-white/60 text-sm font-light">support@nym.nyc</p>
            </a>
            
            {/* Hours */}
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white text-lg font-light mb-2">Hours</h3>
              <p className="text-white/60 text-sm font-light">8 AM - 10 PM Daily</p>
            </div>
            
          </div>
          
          {/* Contact Form and Live Chat */}
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 mb-20">
            
            {/* Contact Form */}
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
              <h2 className="text-white text-xl font-light mb-6">Send us a message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white/60 text-sm font-light">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-white/[0.02] border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/60 text-sm font-light">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-white/[0.02] border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orderNumber" className="text-white/60 text-sm font-light">
                    Order Number (optional)
                  </Label>
                  <Input
                    id="orderNumber"
                    placeholder="ORD-20250130-XXXX"
                    value={formData.orderNumber}
                    onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                    className="bg-white/[0.02] border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-white/60 text-sm font-light">Message</Label>
                  <Textarea
                    id="message"
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="bg-white/[0.02] border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500/50"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-emerald-500 text-black hover:bg-emerald-400 font-light"
                >
                  Send Message
                </Button>
              </form>
            </div>

            {/* Live Chat Card */}
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white text-lg font-light">Live Chat</h3>
                  <p className="text-white/40 text-sm font-light">Get instant help from our support team</p>
                </div>
              </div>
              
              <Button 
                onClick={() => setShowChat(true)}
                className="w-full bg-white/5 border border-white/10 text-white hover:bg-white/10 font-light"
                variant="outline"
              >
                Start Live Chat
              </Button>
            </div>
            
          </div>
          
          {/* FAQs */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-white text-3xl font-light tracking-tight mb-8 text-center">
              Common Questions
            </h2>
            
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <details 
                  key={index}
                  className="group bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-xl p-6 hover:border-white/10 transition-colors"
                >
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-white text-lg font-light pr-4">
                      {faq.question}
                    </h3>
                    <svg 
                      className="w-5 h-5 text-white/40 group-open:rotate-180 transition-transform flex-shrink-0" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <p className="mt-4 text-white/60 text-sm font-light leading-relaxed">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
          
        </div>
        
      </section>
      {showChat && <LiveChatWidget onClose={() => setShowChat(false)} />}
    </CustomerLayout>
  );
};

export default Support;
