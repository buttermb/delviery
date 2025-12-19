import { SEOHead } from "@/components/SEOHead";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function GettingStartedPage() {
  return (
    <>
      <SEOHead 
        title="Getting Started - API Documentation - DevPanel"
        description="Quick start guide to integrate with the DevPanel API. Learn authentication, setup, and make your first API call."
      />
      
      <DocsLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-4 text-foreground">Getting Started</h1>
            <p className="text-lg text-muted-foreground">
              Get up and running with the DevPanel API in minutes. This guide covers authentication, setup, and your first API call.
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Enterprise Access:</strong> API access is available for Professional and Enterprise tier customers. Contact sales to upgrade your plan.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Base URL</CardTitle>
              <CardDescription>All API requests should be made to this base URL</CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock 
                code="https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/" 
                language="text"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>Follow these steps to make your first API call</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Authenticate</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      First, obtain an authentication token by logging in with your admin credentials.
                    </p>
                    <CodeBlock 
                      code={`curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/admin-auth \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "login",
    "email": "admin@example.com",
    "password": "your_password"
  }'`}
                      language="bash"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Save the Token</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      The response will include a session token. Store this securely.
                    </p>
                    <CodeBlock 
                      code={`{
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2024-01-01T00:00:00Z"
  },
  "admin": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "admin"
  }
}`}
                      language="json"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Make Your First Request</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Use the token in the Authorization header for subsequent requests.
                    </p>
                    <CodeBlock 
                      code={`curl -X POST https://aejugtmhwwknrowfyzie.supabase.co/functions/v1/admin-api-operations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -d '{
    "action": "list",
    "resource": "products"
  }'`}
                      language="bash"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center gap-2 text-success mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="font-semibold">Success!</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  You've made your first API call. Check out the API Reference section to explore all available endpoints.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Authentication Overview</CardTitle>
              <CardDescription>DevPanel uses JWT-based authentication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Token Expiration</h4>
                <p className="text-sm text-muted-foreground">
                  Tokens expire after 8 hours. You'll need to re-authenticate when your token expires.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Three-Tier Access</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong className="text-foreground">Super Admin:</strong> Platform-level access to all tenants</li>
                  <li>• <strong className="text-foreground">Tenant Admin:</strong> Business owner access to specific tenant</li>
                  <li>• <strong className="text-foreground">Customer:</strong> End-user access to customer portal</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Common HTTP Status Codes</CardTitle>
              <CardDescription>Understanding API responses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <code className="text-success font-mono">200</code>
                  <span className="text-muted-foreground">Success - Request completed successfully</span>
                </div>
                <div className="flex gap-3">
                  <code className="text-warning font-mono">400</code>
                  <span className="text-muted-foreground">Bad Request - Invalid request parameters</span>
                </div>
                <div className="flex gap-3">
                  <code className="text-destructive font-mono">401</code>
                  <span className="text-muted-foreground">Unauthorized - Missing or invalid token</span>
                </div>
                <div className="flex gap-3">
                  <code className="text-destructive font-mono">403</code>
                  <span className="text-muted-foreground">Forbidden - Insufficient permissions</span>
                </div>
                <div className="flex gap-3">
                  <code className="text-destructive font-mono">500</code>
                  <span className="text-muted-foreground">Server Error - Something went wrong on our end</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DocsLayout>
    </>
  );
}
