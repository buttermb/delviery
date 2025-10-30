import CustomerLayout from '@/layouts/CustomerLayout';

const Privacy = () => {
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
                Privacy Policy
              </h1>
            </div>
            
            {/* Content */}
            <div className="space-y-8">
              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">1. Information We Collect</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We collect information you provide directly to us, including your name, email address, phone number, 
                  delivery address, and age verification details. We also collect payment information and order history.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">2. How We Use Your Information</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We use your information to process orders, verify your age, communicate with you about your orders, 
                  improve our service, comply with legal requirements, and send promotional communications (with your consent).
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">3. Information Sharing</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We share your information with licensed partner shops and couriers to fulfill your orders. We may also 
                  share information with service providers who assist us in operating our platform, and with law enforcement 
                  when required by law.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">4. Age Verification</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  To comply with New York state law, we verify that all customers are 21 years or older. Your age 
                  verification information is stored securely and used only for compliance purposes. Photo ID verification 
                  is required at delivery.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">5. Data Security</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We implement industry-standard security measures to protect your personal information. However, no 
                  method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">6. Cookies and Tracking</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We use cookies and similar technologies to enhance your experience, analyze site usage, and personalize 
                  content. You can control cookies through your browser settings.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">7. Your Rights</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  You have the right to access, correct, or delete your personal information. You can also opt out of 
                  marketing communications at any time. To exercise these rights, contact us at privacy@newyorkminutenyc.com.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">8. Data Retention</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We retain your information for as long as necessary to provide our services and comply with legal 
                  obligations. Order records are retained for regulatory compliance purposes.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">9. Children's Privacy</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  Our service is not intended for individuals under 21 years of age. We do not knowingly collect 
                  information from anyone under 21.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">10. Changes to This Policy</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of significant changes by 
                  posting the new policy on this page and updating the "Last Updated" date.
                </p>
              </section>

              <section className="bg-white/[0.02] backdrop-blur-2xl border border-white/[0.05] rounded-2xl p-8">
                <h2 className="text-white text-2xl font-light mb-4">11. Contact Us</h2>
                <p className="text-white/60 text-sm font-light leading-relaxed">
                  For questions about this Privacy Policy, please contact us at privacy@newyorkminutenyc.com or 
                  visit our support page.
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

export default Privacy;
