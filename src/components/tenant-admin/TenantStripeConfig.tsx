import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

interface StripeConfig {
  secretKey: string;
  publishableKey: string;
}

export function TenantStripeConfig() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [config, setConfig] = useState<StripeConfig>({ secretKey: "", publishableKey: "" });
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown");
  const [statusMessage, setStatusMessage] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);

  // Load existing configuration
  useEffect(() => {
    loadConfiguration();
  }, [tenantId]);

  const loadConfiguration = async () => {
    if (!tenantId) return;

    try {
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!account) return;

      const { data: settings } = await supabase
        .from("account_settings")
        .select("integration_settings")
        .eq("account_id", account.id)
        .maybeSingle();

      if (settings?.integration_settings) {
        const integrationSettings = settings.integration_settings as any;
        setConfig({
          secretKey: integrationSettings.stripe_secret_key || "",
          publishableKey: integrationSettings.stripe_publishable_key || "",
        });

        // Check connection status if keys exist
        if (integrationSettings.stripe_secret_key) {
          await testConnection(integrationSettings.stripe_secret_key, true);
        }
      }
    } catch (error) {
      logger.error("Error loading Stripe configuration:", error);
    }
  };

  const testConnection = async (secretKey?: string, silent = false) => {
    const keyToTest = secretKey || config.secretKey;

    if (!keyToTest) {
      toast({
        title: "Missing API Key",
        description: "Please enter your Stripe Secret Key first",
        variant: "destructive",
      });
      return;
    }

    if (!keyToTest.startsWith("sk_")) {
      toast({
        title: "Invalid Key Format",
        description: "Secret key must start with 'sk_', not 'pk_' or 'rk_'",
        variant: "destructive",
      });
      return;
    }

    setTestLoading(true);
    setConnectionStatus("unknown");

    try {
      const { data, error } = await supabase.functions.invoke("verify-tenant-stripe", {
        body: { stripeSecretKey: keyToTest },
      });

      if (error) throw error;

      if (data.valid) {
        setConnectionStatus("connected");
        setStatusMessage(data.testMode ? "Connected (Test Mode)" : "Connected (Live Mode)");
        setIsTestMode(data.testMode);

        if (!silent) {
          toast({
            title: "✅ Connection Successful",
            description: data.testMode
              ? "Test mode credentials verified successfully"
              : "Live mode credentials verified successfully",
          });
        }
      } else {
        setConnectionStatus("error");
        setStatusMessage(data.error || "Connection failed");

        if (!silent) {
          toast({
            title: "Connection Failed",
            description: data.error || "Unable to verify Stripe credentials",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      setConnectionStatus("error");
      setStatusMessage(error.message || "Connection test failed");

      if (!silent) {
        toast({
          title: "Connection Error",
          description: error.message || "Failed to test Stripe connection",
          variant: "destructive",
        });
      }
    } finally {
      setTestLoading(false);
    }
  };

  const saveConfiguration = async () => {
    if (!tenantId) {
      toast({
        title: "Error",
        description: "Tenant ID not found",
        variant: "destructive",
      });
      return;
    }

    if (!config.secretKey) {
      toast({
        title: "Missing Secret Key",
        description: "Please enter your Stripe Secret Key",
        variant: "destructive",
      });
      return;
    }

    if (!config.secretKey.startsWith("sk_")) {
      toast({
        title: "Invalid Key Format",
        description: "Secret key must start with 'sk_', not 'pk_' or 'rk_'",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // First, verify the connection
      await testConnection(config.secretKey, true);

      if (connectionStatus === "error") {
        toast({
          title: "Invalid Credentials",
          description: "Please verify your Stripe API keys are correct",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Get account ID
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (accountError || !account) throw new Error("Account not found");

      // Save to account_settings
      const { error: updateError } = await supabase
        .from("account_settings")
        .upsert({
          account_id: account.id,
          integration_settings: {
            stripe_secret_key: config.secretKey,
            stripe_publishable_key: config.publishableKey,
          },
        }, {
          onConflict: "account_id",
        });

      if (updateError) throw updateError;

      toast({
        title: "✅ Configuration Saved",
        description: "Your Stripe credentials have been saved successfully",
      });

      // Reload to confirm
      await loadConfiguration();
    } catch (error: any) {
      logger.error("Error saving Stripe configuration:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save Stripe configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Stripe Payment Configuration</span>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="text-sm font-normal text-muted-foreground">
              {connectionStatus === "connected" && statusMessage}
              {connectionStatus === "error" && "Not Connected"}
              {connectionStatus === "unknown" && "Not Configured"}
            </span>
          </div>
        </CardTitle>
        <CardDescription>
          Configure your Stripe account to accept payments from your customers. This is separate from your platform subscription billing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> You need a full Secret Key (sk_test_... or sk_live_...), not a Restricted Key (rk_...).
            Get your API keys from your <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline">Stripe Dashboard</a>.
          </AlertDescription>
        </Alert>

        {isTestMode && connectionStatus === "connected" && (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>Test Mode Active:</strong> You're using test credentials. Use live keys to accept real payments.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secretKey">Stripe Secret Key *</Label>
            <div className="relative">
              <Input
                id="secretKey"
                type={showSecretKey ? "text" : "password"}
                placeholder="sk_test_... or sk_live_..."
                value={config.secretKey}
                onChange={(e) => setConfig({ ...config, secretKey: e.target.value })}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Required. Must start with sk_test_ or sk_live_
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publishableKey">Stripe Publishable Key (Optional)</Label>
            <Input
              id="publishableKey"
              type="text"
              placeholder="pk_test_... or pk_live_..."
              value={config.publishableKey}
              onChange={(e) => setConfig({ ...config, publishableKey: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Used for frontend payment forms if needed
            </p>
          </div>
        </div>

        {connectionStatus === "error" && statusMessage && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button
            onClick={saveConfiguration}
            disabled={loading || testLoading}
            className="flex-1"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Configuration
          </Button>
          <Button
            onClick={() => testConnection()}
            disabled={loading || testLoading || !config.secretKey}
            variant="outline"
          >
            {testLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Test Connection
          </Button>
        </div>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">What you can do with Stripe:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Accept credit card and debit card payments</li>
            <li>Process one-time purchases and subscriptions</li>
            <li>Manage customer payment methods</li>
            <li>View transaction history and invoices</li>
            <li>Handle refunds and disputes</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
