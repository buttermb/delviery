import CustomerLayout from '@/layouts/CustomerLayout';

const Terms = () => {
  return (
    <CustomerLayout>
      <div className="container mx-auto px-6 py-16 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing and using this platform, you accept and agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Age Requirement</h2>
            <p className="text-muted-foreground">
              You must be 21 years of age or older to use this service. By using our platform, you represent and 
              warrant that you are at least 21 years old. Valid government-issued photo identification will be 
              required at the time of delivery.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Product Information</h2>
            <p className="text-muted-foreground">
              All products sold through our platform are derived from hemp and contain less than 0.3% Delta-9 THC,
              complying with federal and New York state regulations. Products are sourced from licensed vendors and 
              are third-party lab tested. Lab results are available upon request for all products.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Ordering and Delivery</h2>
            <p className="text-muted-foreground">
              Orders are processed and delivered by licensed local shops and independent couriers. Delivery is 
              available in Brooklyn, Queens, and Manhattan between 8 AM and 10 PM daily. Delivery fees vary by 
              location and are calculated at checkout.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Payment</h2>
            <p className="text-muted-foreground">
              We accept cash on delivery as our primary payment method. Cryptocurrency payments are coming soon. 
              All prices are in USD and include applicable taxes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Returns and Refunds</h2>
            <p className="text-muted-foreground">
              Due to the nature of our products, we cannot accept returns once delivery is completed. If you receive 
              a damaged or incorrect product, please contact our support team within 24 hours for resolution.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">7. User Conduct</h2>
            <p className="text-muted-foreground">
              You agree not to misuse our service, engage in fraudulent activity, or violate any applicable laws. 
              We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              Our platform acts as a connection between customers and licensed retailers. We are not responsible 
              for product quality issues, delivery delays beyond our control, or misuse of products after delivery.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">9. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these terms at any time. Continued use of the service after changes 
              constitutes acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">10. Contact Information</h2>
            <p className="text-muted-foreground">
              For questions about these Terms of Service, please contact us at legal@example.com or visit our 
              support page.
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

export default Terms;
