import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MessageCircle, Phone, Mail, Video } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";

export default function Contact() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    inquiryType: "general",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate form submission
    setTimeout(() => {
      toast({
        title: "Message sent!",
        description: "We'll get back to you within 1 hour during business hours.",
      });
      setFormData({
        name: "",
        email: "",
        company: "",
        phone: "",
        inquiryType: "general",
        message: "",
      });
      setLoading(false);
    }, 1000);
  };

  return (
    <ForceLightMode>
      <div className="min-h-dvh bg-[hsl(var(--marketing-bg))]">
        <SEOHead
          title="Contact Us - FloraIQ | Get in Touch"
          description="Contact FloraIQ support, sales, or schedule a demo. We're here to help with your wholesale distribution needs."
        />

        <MarketingNav />

        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h1 className="text-4xl md:text-6xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
                Get in Touch
              </h1>
              <p className="text-xl text-[hsl(var(--marketing-text-light))]">
                We're here to help. Choose the best way to reach us.
              </p>
            </div>

            {/* Contact Methods */}
            <div className="grid md:grid-cols-2 gap-6 mb-16">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mb-4">
                    <MessageCircle className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
                  </div>
                  <CardTitle className="font-serif">LIVE CHAT</CardTitle>
                  <CardDescription>Chat with our team right now</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
                    Start Chat
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mb-4">
                    <Phone className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
                  </div>
                  <CardTitle className="font-serif">PHONE</CardTitle>
                  <CardDescription>(555) 123-4567</CardDescription>
                  <CardDescription className="mt-2">Mon-Fri 9am-6pm PST</CardDescription>
                </CardHeader>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mb-4">
                    <Mail className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
                  </div>
                  <CardTitle className="font-serif">EMAIL</CardTitle>
                  <CardDescription>support@floraiq.com</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <a href="mailto:support@floraiq.com">Email Us</a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-[hsl(var(--marketing-primary))]/10 flex items-center justify-center mb-4">
                    <Video className="h-6 w-6 text-[hsl(var(--marketing-primary))]" />
                  </div>
                  <CardTitle className="font-serif">DEMO</CardTitle>
                  <CardDescription>See FloraIQ in action</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/demo">Book Demo</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="border-t border-[hsl(var(--marketing-border))] pt-16">
              <h2 className="text-2xl font-bold mb-6 text-[hsl(var(--marketing-text))]">
                OR FILL OUT THE FORM:
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <Label>How can we help? *</Label>
                  <RadioGroup
                    value={formData.inquiryType}
                    onValueChange={(value) => setFormData({ ...formData, inquiryType: value })}
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="general" id="general" />
                      <Label htmlFor="general" className="font-normal cursor-pointer">General question</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sales" id="sales" />
                      <Label htmlFor="sales" className="font-normal cursor-pointer">Sales inquiry</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="support" id="support" />
                      <Label htmlFor="support" className="font-normal cursor-pointer">Technical support</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="partnership" id="partnership" />
                      <Label htmlFor="partnership" className="font-normal cursor-pointer">Partnership opportunity</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="other" id="other" />
                      <Label htmlFor="other" className="font-normal cursor-pointer">Other</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    className="mt-2"
                    placeholder="I'm interested in learning more about..."
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white h-12"
                >
                  {loading ? "Sending..." : "Send Message"}
                </Button>

                <p className="text-sm text-[hsl(var(--marketing-text-light))] text-center">
                  We typically respond within 1 hour during business hours.
                </p>
              </form>
            </div>

            {/* Office Info */}
            <div className="border-t border-[hsl(var(--marketing-border))] pt-16 mt-16">
              <h2 className="text-2xl font-bold mb-4 text-[hsl(var(--marketing-text))]">OFFICE</h2>
              <p className="text-[hsl(var(--marketing-text))] mb-2">123 Main Street, Suite 100</p>
              <p className="text-[hsl(var(--marketing-text))] mb-4">San Francisco, CA 94105</p>
              <Button variant="outline" asChild>
                <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">
                  View on Map →
                </a>
              </Button>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </div>
    </ForceLightMode>
  );
}

