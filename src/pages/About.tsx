import CustomerLayout from '@/layouts/CustomerLayout';
import { Leaf, Shield, Truck, Users } from "lucide-react";

const About = () => {
  return (
    <CustomerLayout>
      <section className="py-32 bg-black relative overflow-hidden">
        
        {/* Background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto">
            
            {/* Header */}
            <div className="text-center mb-20">
              <div className="inline-block px-4 py-1.5 mb-6 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-full">
                <span className="text-[10px] text-white/50 font-light tracking-[0.2em] uppercase">
                  Our Story
                </span>
              </div>
              
              <h1 className="text-white font-light text-6xl md:text-7xl tracking-tight mb-6">
                About Our Service
              </h1>
              
              <p className="text-white/40 text-xl font-light leading-relaxed max-w-2xl mx-auto">
                Your trusted premium delivery service. We partner with licensed cultivators
                to bring you the finest selection of products—delivered fast and discreetly.
              </p>
            </div>
            
            {/* Features Grid */}
            <div className="grid md:grid-cols-2 gap-8 mb-16">
              <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8 hover:border-white/10 transition-colors">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6">
                  <Leaf className="w-6 h-6" />
                </div>
                <h2 className="text-white text-xl font-light mb-4">Premium Quality</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We work exclusively with licensed NYC cultivators who grow premium indoor flower. Every product 
                  is third-party lab tested for potency, purity, and contaminants before it reaches you.
                </p>
              </div>

              <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8 hover:border-white/10 transition-colors">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6">
                  <Shield className="w-6 h-6" />
                </div>
                <h2 className="text-white text-xl font-light mb-4">Licensed & Compliant</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  Licensed Cannabinoid Hemp Retailer by the NY Office of Cannabis Management. All products are 
                  derived from hemp and comply with federal and state regulations.
                </p>
              </div>

              <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8 hover:border-white/10 transition-colors">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6">
                  <Truck className="w-6 h-6" />
                </div>
                <h2 className="text-white text-xl font-light mb-4">Fast Delivery</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  Same-day delivery across NYC, typically within 30-45 minutes. Professional drivers, discreet 
                  packaging, and real-time order tracking.
                </p>
              </div>

              <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8 hover:border-white/10 transition-colors">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6">
                  <Users className="w-6 h-6" />
                </div>
                <h2 className="text-white text-xl font-light mb-4">Curated Selection</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We carefully select strains and products from cultivators who prioritize quality. Hand-trimmed flower,
                  properly cured, and consistently potent.
                </p>
              </div>
            </div>

            {/* Mission */}
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8 mb-8">
              <h2 className="text-white text-2xl font-light mb-4">Our Mission</h2>
              <p className="text-white/60 text-sm font-light leading-relaxed">
                We started with a simple mission: make premium products accessible to customers who want 
                quality, consistency, and convenience. No hassle, no compromise—just great products delivered fast.
              </p>
            </div>

            {/* Standards */}
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8 mb-8">
              <h2 className="text-white text-2xl font-light mb-6">Our Standards</h2>
              <ul className="grid md:grid-cols-2 gap-3 list-none space-y-2">
                <li className="flex items-start gap-3 text-white/60 text-sm font-light">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Work only with licensed, compliant vendors</span>
                </li>
                <li className="flex items-start gap-3 text-white/60 text-sm font-light">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Third-party lab test every batch</span>
                </li>
                <li className="flex items-start gap-3 text-white/60 text-sm font-light">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Premium indoor-grown products only</span>
                </li>
                <li className="flex items-start gap-3 text-white/60 text-sm font-light">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Proper curing and quality control</span>
                </li>
                <li className="flex items-start gap-3 text-white/60 text-sm font-light">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Professional, discreet delivery</span>
                </li>
                <li className="flex items-start gap-3 text-white/60 text-sm font-light">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>21+ age verification on every order</span>
                </li>
                <li className="flex items-start gap-3 text-white/60 text-sm font-light">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Transparent pricing—no hidden fees</span>
                </li>
                <li className="flex items-start gap-3 text-white/60 text-sm font-light">
                  <span className="text-emerald-500 mt-1">✓</span>
                  <span>Dedicated customer support</span>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
              <h2 className="text-white text-2xl font-light mb-4">Questions?</h2>
              <p className="text-white/60 text-sm font-light mb-6">
                Our team is here to help.
              </p>
              <div className="space-y-2 text-white/60 text-sm font-light mb-6">
                <p>Email: support@example.com</p>
                <p>Phone: (555) 123-4567</p>
                <p>Hours: 8 AM - 10 PM, 7 Days a Week</p>
              </div>
              <div className="pt-6 border-t border-white/5 text-xs text-white/30 font-light">
                <p className="font-light text-white/40 mb-1">Licensed Cannabinoid Hemp Retailer</p>
                <p>NY Office of Cannabis Management License #[Pending]</p>
              </div>
            </div>
            
          </div>
        </div>
        
      </section>
    </CustomerLayout>
  );
};

export default About;
