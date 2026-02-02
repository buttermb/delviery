import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function DemoRequest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    companySize: "",
    orderVolume: "",
    interests: "",
    preferredDate: "",
    preferredTime: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Demo scheduled!",
        description: "We've sent a confirmation email.",
      });
      navigate("/demo/confirm", { state: formData });
    }, 1000);
  };

  return (
    <div className="min-h-dvh bg-[hsl(var(--marketing-bg))]">
      <SEOHead
        title="Schedule Your Free Demo - FloraIQ"
        description="See FloraIQ in action with a personalized demo. No commitment required. 30-minute demo with product expert."
      />

      <MarketingNav />

      <section className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[hsl(var(--marketing-text))]">
              Schedule Your Free Demo
            </h1>
            <p className="text-xl text-[hsl(var(--marketing-text-light))]">
              See FloraIQ in action with a personalized demo.
              <br />
              No commitment required.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Demo Request Details</CardTitle>
              <CardDescription>Fill out the form below and we'll schedule your demo</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
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
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      required
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="companySize">Company Size</Label>
                    <Select
                      value={formData.companySize}
                      onValueChange={(value) => setFormData({ ...formData, companySize: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10 employees</SelectItem>
                        <SelectItem value="11-50">11-50 employees</SelectItem>
                        <SelectItem value="51-200">51-200 employees</SelectItem>
                        <SelectItem value="201+">201+ employees</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="orderVolume">Current monthly order volume</Label>
                  <Select
                    value={formData.orderVolume}
                    onValueChange={(value) => setFormData({ ...formData, orderVolume: value })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select volume" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="<50k">&lt; $50k</SelectItem>
                      <SelectItem value="50k-250k">$50k - $250k</SelectItem>
                      <SelectItem value="250k-1m">$250k - $1M</SelectItem>
                      <SelectItem value="1m+">$1M+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="interests">What would you like to see? (optional)</Label>
                  <Textarea
                    id="interests"
                    rows={3}
                    value={formData.interests}
                    onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                    className="mt-2"
                    placeholder="Disposable menus, inventory tracking..."
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="preferredDate">Preferred date</Label>
                    <Input
                      id="preferredDate"
                      type="date"
                      value={formData.preferredDate}
                      onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferredTime">Preferred time</Label>
                    <Select
                      value={formData.preferredTime}
                      onValueChange={(value) => setFormData({ ...formData, preferredTime: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9am">9:00 AM PST</SelectItem>
                        <SelectItem value="10am">10:00 AM PST</SelectItem>
                        <SelectItem value="11am">11:00 AM PST</SelectItem>
                        <SelectItem value="12pm">12:00 PM PST</SelectItem>
                        <SelectItem value="1pm">1:00 PM PST</SelectItem>
                        <SelectItem value="2pm">2:00 PM PST</SelectItem>
                        <SelectItem value="3pm">3:00 PM PST</SelectItem>
                        <SelectItem value="4pm">4:00 PM PST</SelectItem>
                        <SelectItem value="5pm">5:00 PM PST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-[hsl(var(--marketing-bg-subtle))] p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-accent))]" />
                    <span className="text-[hsl(var(--marketing-text))]">30-minute personalized demo</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-accent))]" />
                    <span className="text-[hsl(var(--marketing-text))]">Q&A with product expert</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-[hsl(var(--marketing-accent))]" />
                    <span className="text-[hsl(var(--marketing-text))]">Custom pricing quote</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white h-12"
                >
                  {loading ? "Scheduling..." : "Schedule Demo"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

