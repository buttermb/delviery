import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { SEOHead } from '@/components/SEOHead';

export default function CompanySettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { account, accountSettings, loading: accountLoading, refreshAccount } = useAccount();
  const [loading, setLoading] = useState(false);
  const [companyData, setCompanyData] = useState({
    company_name: '',
    slug: '',
    billing_email: ''
  });
  const [settingsData, setSettingsData] = useState({
    business_license: '',
    tax_rate: 0,
    state: '',
    operating_states: [] as string[]
  });

  useEffect(() => {
    if (!accountLoading && !account) {
      navigate('/admin/dashboard');
    }
  }, [account, accountLoading, navigate]);

  useEffect(() => {
    if (account) {
      setCompanyData({
        company_name: account.company_name || '',
        slug: account.slug || '',
        billing_email: account.billing_email || ''
      });
    }
    if (accountSettings) {
      setSettingsData({
        business_license: accountSettings.business_license || '',
        tax_rate: accountSettings.tax_rate || 0,
        state: accountSettings.state || '',
        operating_states: accountSettings.operating_states || []
      });
    }
  }, [account, accountSettings]);

  const handleSaveCompany = async () => {
    if (!account) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .update(companyData)
        .eq('id', account.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company information updated successfully"
      });
      
      await refreshAccount();
    } catch (error) {
      console.error('Error updating company:', error);
      toast({
        title: "Error",
        description: "Failed to update company information",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!account) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('account_settings')
        .update(settingsData)
        .eq('account_id', account.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Settings updated successfully"
      });
      
      await refreshAccount();
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (accountLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Company Settings"
        description="Manage your company settings and preferences"
      />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Company Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your company information and preferences</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="business">Business Details</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>Update your company's basic information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={companyData.company_name}
                    onChange={(e) => setCompanyData({ ...companyData, company_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Company Slug</Label>
                  <Input
                    id="slug"
                    value={companyData.slug}
                    onChange={(e) => setCompanyData({ ...companyData, slug: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_email">Billing Email</Label>
                  <Input
                    id="billing_email"
                    type="email"
                    value={companyData.billing_email}
                    onChange={(e) => setCompanyData({ ...companyData, billing_email: e.target.value })}
                  />
                </div>

                <Button onClick={handleSaveCompany} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Business Details</CardTitle>
                <CardDescription>Configure your business-specific settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="business_license">Business License</Label>
                  <Input
                    id="business_license"
                    value={settingsData.business_license}
                    onChange={(e) => setSettingsData({ ...settingsData, business_license: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_rate">Tax Rate (%)</Label>
                  <Input
                    id="tax_rate"
                    type="number"
                    step="0.01"
                    value={settingsData.tax_rate}
                    onChange={(e) => setSettingsData({ ...settingsData, tax_rate: parseFloat(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">Primary State</Label>
                  <Input
                    id="state"
                    value={settingsData.state}
                    onChange={(e) => setSettingsData({ ...settingsData, state: e.target.value })}
                  />
                </div>

                <Button onClick={handleSaveSettings} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="branding" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Branding</CardTitle>
                <CardDescription>Customize your brand appearance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground">
                  Branding customization coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Connect third-party services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground">
                  Integration settings coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
