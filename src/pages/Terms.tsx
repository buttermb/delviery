import CustomerLayout from '@/layouts/CustomerLayout';

const Terms = () => {
  return (
    <CustomerLayout>
      <section className="py-32 bg-black relative overflow-hidden">
        
        {/* Background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto">
            
            {/* Header */}
            <div className="text-center mb-16">
              <div className="inline-block px-4 py-1.5 mb-6 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] rounded-full">
                <span className="text-[10px] text-white/50 font-light tracking-[0.2em] uppercase">
                  Legal
                </span>
              </div>
              
              <h1 className="text-white font-light text-6xl md:text-7xl tracking-tight mb-6">
                Terms of Service
              </h1>
            </div>
            
            {/* Content */}
            <div className="space-y-8">
              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">1. Acceptance of Terms</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  By accessing and using Bud-Dash NYC, you accept and agree to be bound by these Terms of Service. 
                  If you do not agree to these terms, please do not use our service.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">2. Age Requirement</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  You must be 21 years of age or older to use this service. By using Bud-Dash NYC, you represent and 
                  warrant that you are at least 21 years old. Valid government-issued photo identification will be 
                  required at the time of delivery.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">3. Product Information</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  All products sold through our platform are derived from hemp and contain less than 0.3% Delta-9 THC,
                  complying with federal and New York state regulations. Products are sourced from licensed vendors and 
                  are third-party lab tested. Lab results are available upon request for all products.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">4. Ordering and Delivery</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  Orders are processed and delivered by licensed local shops and independent couriers. Delivery is 
                  available in Brooklyn, Queens, and Manhattan between 8 AM and 10 PM daily. Delivery fees vary by 
                  location and are calculated at checkout.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">5. Payment</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We accept cash on delivery as our primary payment method. Cryptocurrency payments are coming soon. 
                  All prices are in USD and include applicable taxes.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">6. Returns and Refunds</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  Due to the nature of our products, we cannot accept returns once delivery is completed. If you receive 
                  a damaged or incorrect product, please contact our support team within 24 hours for resolution.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">7. User Conduct</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  You agree not to misuse our service, engage in fraudulent activity, or violate any applicable laws. 
                  We reserve the right to suspend or terminate accounts that violate these terms.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">8. Limitation of Liability</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  Bud-Dash NYC acts as a platform connecting customers with licensed retailers. We are not responsible 
                  for product quality issues, delivery delays beyond our control, or misuse of products after delivery.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">9. Changes to Terms</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We reserve the right to modify these terms at any time. Continued use of the service after changes 
                  constitutes acceptance of the modified terms.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">10. Contact Information</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  For questions about these Terms of Service, please contact us at legal@newyorkminutenyc.com or visit our 
                  support page.
                </p>
              </section>

              <p className="text-center text-white/30 text-xs font-light mt-8">
                Last Updated: January 2025
              </p>
            </div>
            
          </div>
        </div>
        
      </section>
    </CustomerLayout>
  );
};

export default Terms;
