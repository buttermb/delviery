import CustomerLayout from "@/layouts/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, DollarSign, Calendar, Shield } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const BecomeCourier = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    borough: "",
    vehicle: "",
    experience: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('courier_applications')
        .insert({
          full_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          borough: formData.borough,
          vehicle_type: formData.vehicle,
          experience: formData.experience || "No previous experience provided",
        });

      if (error) throw error;

      toast({
        title: "Application Submitted Successfully",
        description: "New York Minute will review your application and get back to you within 48 hours.",
      });
      
      setFormData({
        name: "",
        email: "",
        phone: "",
        borough: "",
        vehicle: "",
        experience: "",
      });
    } catch (error) {
      console.error('Error submitting application:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your application. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-6">Become a New York Minute Courier</h1>
          <p className="text-lg text-muted-foreground mb-12">
            Join New York Minute NYC's network of independent couriers and earn money delivering premium products 
            across New York City. Set your own schedule and be part of the growing legal cannabis industry.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-muted/30 p-6 rounded-lg">
              <DollarSign className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Competitive Pay</h3>
              <p className="text-muted-foreground">
                Earn $20-$40 per hour including tips. Get paid weekly with transparent fee structure.
              </p>
            </div>

            <div className="bg-muted/30 p-6 rounded-lg">
              <Calendar className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Flexible Schedule</h3>
              <p className="text-muted-foreground">
                Work when you want. No minimum hours required. Perfect for full-time or part-time income.
              </p>
            </div>

            <div className="bg-muted/30 p-6 rounded-lg">
              <Shield className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Legal & Safe</h3>
              <p className="text-muted-foreground">
                Deliver premium products with full compliance support and liability protection.
              </p>
            </div>

            <div className="bg-muted/30 p-6 rounded-lg">
              <CheckCircle2 className="w-10 h-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Quick Start</h3>
              <p className="text-muted-foreground">
                Simple onboarding process. Start delivering within a week of approval.
              </p>
            </div>
          </div>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Requirements</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Must be 21 years of age or older</li>
              <li>Valid driver's license or government-issued ID</li>
              <li>Reliable transportation (bike, scooter, car)</li>
              <li>Smartphone with data plan</li>
              <li>Clean background check</li>
              <li>NYC resident (Brooklyn, Queens, or Manhattan)</li>
              <li>Ability to verify customer age and ID at delivery</li>
            </ul>
          </section>

          <section className="bg-card border rounded-lg p-8">
            <h2 className="text-2xl font-semibold mb-6">Apply Now</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
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
              </div>

              <div className="grid md:grid-cols-2 gap-6">
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
                <div className="space-y-2">
                  <Label htmlFor="borough">Borough *</Label>
                  <Input
                    id="borough"
                    placeholder="Brooklyn, Queens, or Manhattan"
                    value={formData.borough}
                    onChange={(e) => setFormData({ ...formData, borough: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle">Type of Vehicle *</Label>
                <Input
                  id="vehicle"
                  placeholder="Bike, scooter, car, etc."
                  value={formData.vehicle}
                  onChange={(e) => setFormData({ ...formData, vehicle: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience">Previous Delivery Experience (Optional)</Label>
                <Textarea
                  id="experience"
                  placeholder="Tell us about your delivery or gig economy experience..."
                  value={formData.experience}
                  onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                  rows={4}
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                By submitting, you agree to our Terms of Service and Privacy Policy. 
                Background check required upon approval.
              </p>
            </form>
          </section>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default BecomeCourier;
