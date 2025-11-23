import { TenantStripeCheckout } from "@/components/tenant-admin/TenantStripeCheckout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function TenantAdminSettingsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and integration settings</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="testing">Testing Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Manage your general account settings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">General settings coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Integration</CardTitle>
              <CardDescription>
                Configure your Stripe account to accept payments from your customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  To configure your Stripe credentials, go to the sidebar → Integrations and click on Stripe.
                  This is separate from the platform subscription billing.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Testing Environment:</strong> Use test credentials to safely test your payment flow without real transactions.
            </AlertDescription>
          </Alert>
          
          <TenantStripeCheckout />
        </TabsContent>
      </Tabs>
    </div>
  );
}