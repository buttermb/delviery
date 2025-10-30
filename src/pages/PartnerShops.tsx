import CustomerLayout from "@/layouts/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Store, TrendingUp, Users, Zap } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const PartnerShops = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    shopName: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
    license: "",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Partnership Request Submitted",
      description: "We'll review your shop details and contact you within 48 hours.",
    });
    setFormData({
      shopName: "",
      ownerName: "",
      email: "",
      phone: "",
      address: "",
      license: "",
      description: "",
    });
  };

  return (
    <CustomerLayout>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-6">Partner with Bud-Dash NYC</h1>
          <p className="text-lg text-muted-foreground mb-12">
            Expand your reach and grow your business by joining our network of licensed NYC cultivators. 
            Connect with thousands of customers across Brooklyn, Queens, and Manhattan.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-muted/30 p-6 rounded-lg">
              <TrendingUp className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Increase Sales</h3>
              <p className="text-muted-foreground">
                Reach new customers beyond your physical location. Average partners see 40% sales increase.
              </p>
            </div>

            <div className="bg-muted/30 p-6 rounded-lg">
              <Users className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Access Our Customer Base</h3>
              <p className="text-muted-foreground">
                Connect with thousands of verified customers actively looking for premium products.
              </p>
            </div>

            <div className="bg-muted/30 p-6 rounded-lg">
              <Zap className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Fast Payouts</h3>
              <p className="text-muted-foreground">
                Get paid quickly with transparent pricing. No hidden fees. Weekly direct deposits.
              </p>
            </div>

            <div className="bg-muted/30 p-6 rounded-lg">
              <Store className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Easy Management</h3>
              <p className="text-muted-foreground">
                Simple dashboard to manage inventory, accept orders, and track deliveries in real-time.
              </p>
            </div>
          </div>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Partnership Benefits</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>No upfront costs or membership fees</li>
              <li>Competitive commission structure (15-20%)</li>
              <li>Marketing and promotional support</li>
              <li>Dedicated account manager</li>
              <li>Free courier network access</li>
              <li>Real-time sales analytics and reporting</li>
              <li>Customer support handled by Bud-Dash</li>
              <li>Compliance and legal support</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Requirements</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Valid New York state cannabis retail license</li>
              <li>Physical location in Brooklyn, Queens, or Manhattan</li>
              <li>Third-party lab testing for all products</li>
              <li>Liability insurance coverage</li>
              <li>Ability to fulfill orders within 15-30 minutes</li>
              <li>Minimum inventory standards</li>
              <li>Commitment to quality and customer service</li>
            </ul>
          </section>

          <section className="bg-card border rounded-lg p-8">
            <h2 className="text-2xl font-semibold mb-6">Apply for Partnership</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="shopName">Shop Name *</Label>
                  <Input
                    id="shopName"
                    value={formData.shopName}
                    onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Owner/Manager Name *</Label>
                  <Input
                    id="ownerName"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Shop Address *</Label>
                <Input
                  id="address"
                  placeholder="Full street address including borough"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="license">License Number *</Label>
                <Input
                  id="license"
                  placeholder="NY state cannabis retail license number"
                  value={formData.license}
                  onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Tell Us About Your Shop</Label>
                <Textarea
                  id="description"
                  placeholder="Product range, years in business, unique offerings..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <Button type="submit" size="lg" className="w-full">
                Submit Partnership Application
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                By submitting, you agree to our Terms of Service and Privacy Policy. 
                License verification required upon approval.
              </p>
            </form>
          </section>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default PartnerShops;
