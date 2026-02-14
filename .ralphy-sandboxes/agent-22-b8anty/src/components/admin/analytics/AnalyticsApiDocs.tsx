import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { listAdminRecords } from "@/utils/adminApiClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { Copy, Key, ExternalLink } from "lucide-react";
import { EnhancedLoadingState } from "@/components/EnhancedLoadingState";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  is_active: boolean;
  permissions: string[];
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const BASE_URL = `${SUPABASE_URL}/functions/v1/analytics-api`;

const ENDPOINTS = [
  {
    name: "revenue",
    description: "Revenue summary including total revenue, order count, and average order value.",
    params: [
      { name: "start_date", type: "ISO 8601", required: false, description: "Period start (defaults to 30 days ago)" },
      { name: "end_date", type: "ISO 8601", required: false, description: "Period end (defaults to now)" },
    ],
    exampleResponse: {
      success: true,
      endpoint: "revenue",
      data: {
        total_revenue: 45230.5,
        order_count: 187,
        average_order_value: 241.88,
        period: { start: "2026-01-01T00:00:00Z", end: "2026-01-31T23:59:59Z" },
      },
      generated_at: "2026-02-01T12:00:00Z",
    },
  },
  {
    name: "orders",
    description: "Orders summary with status breakdown. Returns up to 500 most recent orders in the period.",
    params: [
      { name: "start_date", type: "ISO 8601", required: false, description: "Period start" },
      { name: "end_date", type: "ISO 8601", required: false, description: "Period end" },
    ],
    exampleResponse: {
      success: true,
      endpoint: "orders",
      data: {
        total_orders: 187,
        by_status: { completed: 150, pending: 25, cancelled: 12 },
        total_revenue: 45230.5,
        period: { start: "2026-01-01T00:00:00Z", end: "2026-01-31T23:59:59Z" },
      },
      generated_at: "2026-02-01T12:00:00Z",
    },
  },
  {
    name: "inventory",
    description: "Current inventory snapshot with stock levels and total inventory value.",
    params: [],
    exampleResponse: {
      success: true,
      endpoint: "inventory",
      data: {
        total_products: 64,
        in_stock: 52,
        low_stock: 8,
        out_of_stock: 4,
        total_inventory_value: 128450.0,
      },
      generated_at: "2026-02-01T12:00:00Z",
    },
  },
  {
    name: "customers",
    description: "Customer count and new customers acquired in the date range.",
    params: [
      { name: "start_date", type: "ISO 8601", required: false, description: "Period start" },
      { name: "end_date", type: "ISO 8601", required: false, description: "Period end" },
    ],
    exampleResponse: {
      success: true,
      endpoint: "customers",
      data: {
        total_customers: 342,
        new_customers_in_period: 28,
        period: { start: "2026-01-01T00:00:00Z", end: "2026-01-31T23:59:59Z" },
      },
      generated_at: "2026-02-01T12:00:00Z",
    },
  },
] as const;

export default function AnalyticsApiDocs() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ["api-keys", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await listAdminRecords("api_keys");
      if (error) {
        logger.error("Error fetching API keys for docs page", error);
        return [];
      }
      return (data ?? []) as ApiKey[];
    },
    enabled: !!tenantId,
  });

  const activeKeys = apiKeys?.filter((k) => k.is_active) ?? [];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics API</h1>
          <p className="text-muted-foreground">REST API documentation for external integrations</p>
        </div>
        <EnhancedLoadingState variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics API</h1>
          <p className="text-muted-foreground">
            REST API documentation for external BI tools and integrations
          </p>
        </div>
        <Badge variant="secondary">v1</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="keys">Your API Keys</TabsTrigger>
        </TabsList>

        {/* --- Overview --- */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Base URL</CardTitle>
              <CardDescription>All requests use this base URL with query parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                  {BASE_URL}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(BASE_URL, "Base URL")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>API key via Authorization header</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Include your API key in the <code className="bg-muted px-1 rounded">Authorization</code> header as a Bearer token.
                Keys are created in the <strong>API Access</strong> settings page.
              </p>
              <div className="bg-muted rounded p-3 font-mono text-sm">
                <span className="text-blue-500">GET</span> {BASE_URL}?endpoint=revenue
                <br />
                <span className="text-green-500">Authorization:</span> Bearer sk_your_api_key_here
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate Limits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                60 requests per minute per API key. Rate limit info is returned in response headers:
              </p>
              <ul className="mt-2 text-sm space-y-1 text-muted-foreground list-disc list-inside">
                <li><code className="bg-muted px-1 rounded">X-RateLimit-Limit</code> &mdash; Max requests per window</li>
                <li><code className="bg-muted px-1 rounded">X-RateLimit-Remaining</code> &mdash; Remaining requests</li>
                <li><code className="bg-muted px-1 rounded">X-RateLimit-Reset</code> &mdash; Window reset time (Unix seconds)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Start (cURL)</CardTitle>
            </CardHeader>
            <CardContent>
              <CurlExample
                endpoint="revenue"
                apiKey={activeKeys[0]?.key}
                onCopy={handleCopy}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Endpoints --- */}
        <TabsContent value="endpoints" className="space-y-4">
          {ENDPOINTS.map((ep) => (
            <Card key={ep.name}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge>GET</Badge>
                  <CardTitle className="font-mono text-base">
                    ?endpoint={ep.name}
                  </CardTitle>
                </div>
                <CardDescription>{ep.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ep.params.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Query Parameters</h4>
                    <div className="border rounded">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Type</th>
                            <th className="text-left p-2">Required</th>
                            <th className="text-left p-2">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ep.params.map((p) => (
                            <tr key={p.name} className="border-b last:border-0">
                              <td className="p-2 font-mono">{p.name}</td>
                              <td className="p-2">{p.type}</td>
                              <td className="p-2">{p.required ? "Yes" : "No"}</td>
                              <td className="p-2 text-muted-foreground">{p.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-2">Example Response</h4>
                  <pre className="bg-muted rounded p-3 text-sm font-mono overflow-x-auto whitespace-pre">
                    {JSON.stringify(ep.exampleResponse, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* --- API Keys --- */}
        <TabsContent value="keys" className="space-y-4">
          {activeKeys.length > 0 ? (
            activeKeys.map((k) => (
              <Card key={k.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      <CardTitle className="text-base">{k.name}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(k.key, "API key")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.permissions?.length > 0 && (
                      <span className="ml-2">
                        {k.permissions.map((p) => (
                          <Badge key={p} variant="outline" className="ml-1 text-xs">
                            {p}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <code className="text-sm bg-muted px-2 py-1 rounded font-mono break-all">
                    {k.key.slice(0, 20)}...
                  </code>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active API keys found.</p>
                <p className="text-sm mt-1">
                  Create an API key in the{" "}
                  <a href="../api-access" className="underline inline-flex items-center gap-1">
                    API Access <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  page to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CurlExample({
  endpoint,
  apiKey,
  onCopy,
}: {
  endpoint: string;
  apiKey?: string;
  onCopy: (text: string, label: string) => void;
}) {
  const key = apiKey ? apiKey.slice(0, 8) + "..." : "sk_your_api_key";
  const cmd = `curl "${BASE_URL}?endpoint=${endpoint}" \\\n  -H "Authorization: Bearer ${key}"`;

  return (
    <div className="relative">
      <pre className="bg-muted rounded p-3 text-sm font-mono overflow-x-auto whitespace-pre">
        {cmd}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2"
        onClick={() => onCopy(cmd, "cURL command")}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}
