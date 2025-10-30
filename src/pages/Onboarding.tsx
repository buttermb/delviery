import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Building, MapPin, Users, CheckCircle } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { account, refreshAccount } = useAccount();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [companyData, setCompanyData] = useState({
    company_name: '',
    business_license: '',
    tax_rate: 0,
    state: '',
    billing_email: ''
  });

  const [locationData, setLocationData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: ''
  });

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const handleCompanySubmit = async () => {
    if (!account) return;

    setLoading(true);
    try {
      // Update account
      const { error: accountError } = await supabase
        .from('accounts')
        .update({
          company_name: companyData.company_name,
          billing_email: companyData.billing_email
        })
        .eq('id', account.id);

      if (accountError) throw accountError;

      // Update account settings
      const { error: settingsError } = await supabase
        .from('account_settings')
        .update({
          business_license: companyData.business_license,
          tax_rate: companyData.tax_rate,
          state: companyData.state
        })
        .eq('account_id', account.id);

      if (settingsError) throw settingsError;

      await refreshAccount();
      setStep(2);
    } catch (error) {
      console.error('Error updating company:', error);
      toast({
        title: "Error",
        description: "Failed to save company information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSubmit = async () => {
    if (!account) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('locations')
        .insert({
          account_id: account.id,
          ...locationData
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Location added successfully"
      });
      
      setStep(3);
    } catch (error) {
      console.error('Error adding location:', error);
      toast({
        title: "Error",
        description: "Failed to add location",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    toast({
      title: "Welcome!",
      description: "Your account is now set up"
    });
    navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEOHead 
        title="Account Setup"
        description="Complete your account setup"
      />

      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to Your Account</h1>
          <p className="text-muted-foreground">Let's get your business set up</p>
        </div>

        <Progress value={progress} className="mb-8" />

        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>Tell us about your business</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  value={companyData.company_name}
                  onChange={(e) => setCompanyData({ ...companyData, company_name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_email">Billing Email *</Label>
                <Input
                  id="billing_email"
                  type="email"
                  value={companyData.billing_email}
                  onChange={(e) => setCompanyData({ ...companyData, billing_email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_license">Business License</Label>
                <Input
                  id="business_license"
                  value={companyData.business_license}
                  onChange={(e) => setCompanyData({ ...companyData, business_license: e.target.value })}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={companyData.state}
                    onChange={(e) => setCompanyData({ ...companyData, state: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                  <Input
                    id="tax_rate"
                    type="number"
                    step="0.01"
                    value={companyData.tax_rate}
                    onChange={(e) => setCompanyData({ ...companyData, tax_rate: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button onClick={handleCompanySubmit} disabled={loading}>
                  {loading ? 'Saving...' : 'Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Primary Location</CardTitle>
                  <CardDescription>Add your main business location</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location_name">Location Name *</Label>
                <Input
                  id="location_name"
                  value={locationData.name}
                  onChange={(e) => setLocationData({ ...locationData, name: e.target.value })}
                  placeholder="e.g., Main Office"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Street Address *</Label>
                <Input
                  id="address"
                  value={locationData.address}
                  onChange={(e) => setLocationData({ ...locationData, address: e.target.value })}
                  required
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={locationData.city}
                    onChange={(e) => setLocationData({ ...locationData, city: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location_state">State *</Label>
                  <Input
                    id="location_state"
                    value={locationData.state}
                    onChange={(e) => setLocationData({ ...locationData, state: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip_code">ZIP Code *</Label>
                  <Input
                    id="zip_code"
                    value={locationData.zip_code}
                    onChange={(e) => setLocationData({ ...locationData, zip_code: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={locationData.phone}
                  onChange={(e) => setLocationData({ ...locationData, phone: e.target.value })}
                />
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={handleLocationSubmit} disabled={loading}>
                  {loading ? 'Saving...' : 'Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>All Set!</CardTitle>
                  <CardDescription>Your account is ready to use</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Welcome to the Platform!</h3>
                <p className="text-muted-foreground mb-6">
                  Your account has been successfully set up. You can now access your dashboard and start managing your business.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 text-center">
                <div className="p-4 border rounded-lg">
                  <Building className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Manage Locations</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Invite Team Members</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-medium">Track Orders</p>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button size="lg" onClick={handleComplete}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
