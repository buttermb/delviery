import CustomerLayout from '@/layouts/CustomerLayout';

const Privacy = () => {
  return (
    <CustomerLayout>
      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground">
              We collect information you provide directly to us, including your name, email address, phone number, 
              delivery address, and age verification details. We also collect payment information and order history.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground">
              We use your information to process orders, verify your age, communicate with you about your orders, 
              improve our service, comply with legal requirements, and send promotional communications (with your consent).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Information Sharing</h2>
            <p className="text-muted-foreground">
              We share your information with licensed partner shops and couriers to fulfill your orders. We may also 
              share information with service providers who assist us in operating our platform, and with law enforcement 
              when required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Data Security</h2>
            <p className="text-muted-foreground">
              We implement industry-standard security measures to protect your personal information. However, no 
              method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Your Rights</h2>
            <p className="text-muted-foreground">
              You have the right to access, correct, or delete your personal information. You can also opt out of 
              marketing communications at any time. To exercise these rights, contact us at privacy@example.com.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Contact Us</h2>
            <p className="text-muted-foreground">
              For questions about this Privacy Policy, please contact us at privacy@example.com.
            </p>
          </section>

          <p className="text-sm text-muted-foreground mt-8">
            Last Updated: January 2025
          </p>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default Privacy;
