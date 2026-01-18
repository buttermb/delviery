import { logger } from '@/lib/logger';
import { SEOHead } from "@/components/SEOHead";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Shield, Key, Lock, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AuthenticationPage() {
  return (
    <>
      <SEOHead 
        title="Authentication - API Documentation - DevPanel"
        description="Learn how to authenticate with the DevPanel API using JWT tokens and manage user sessions."
      />
      
      <DocsLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-4 text-foreground">Authentication</h1>
            <p className="text-lg text-muted-foreground">
              DevPanel uses JWT (JSON Web Token) authentication to secure API access. Learn how to authenticate and manage sessions.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Three-Tier Authentication System
              </CardTitle>
              <CardDescription>
                DevPanel implements a hierarchical authentication system with three distinct access levels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-semibold text-lg mb-2 text-foreground">1. Super Admin (Platform Level)</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Highest level of access with full control over the entire platform and all tenants.
                  </p>
                  <CodeBlock 
                    code={`POST /super-admin-auth
{
  "action": "login",
  "email": "superadmin@platform.com",
  "password": "secure_password"
}`}
                    language="json"
                  />
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-semibold text-lg mb-2 text-foreground">2. Tenant Admin (Business Owner)</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Business owner level access to manage their specific tenant and all its resources.
                  </p>
                  <CodeBlock 
                    code={`POST /admin-auth
{
  "action": "login",
  "email": "admin@business.com",
  "password": "secure_password"
}`}
                    language="json"
                  />
                </div>

                <div className="border-l-4 border-emerald-500 pl-4">
                  <h3 className="font-semibold text-lg mb-2 text-foreground">3. Customer (End User)</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Customer portal access for end users to view orders, track deliveries, and manage their account.
                  </p>
                  <CodeBlock 
                    code={`POST /customer-auth
{
  "action": "login",
  "email": "customer@example.com",
  "password": "customer_password"
}`}
                    language="json"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                JWT Token Structure
              </CardTitle>
              <CardDescription>Understanding the token payload and claims</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The JWT token contains encoded information about the authenticated user:
              </p>
              <CodeBlock 
                code={`{
  "sub": "user_uuid",
  "email": "user@example.com",
  "role": "admin",
  "tenant_id": "tenant_uuid",
  "admin_id": "admin_uuid",
  "iat": 1704067200,
  "exp": 1704096000
}`}
                language="json"
              />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong className="text-foreground">sub:</strong>
                  <span className="text-muted-foreground ml-2">User identifier</span>
                </div>
                <div>
                  <strong className="text-foreground">email:</strong>
                  <span className="text-muted-foreground ml-2">User email</span>
                </div>
                <div>
                  <strong className="text-foreground">role:</strong>
                  <span className="text-muted-foreground ml-2">Access role</span>
                </div>
                <div>
                  <strong className="text-foreground">tenant_id:</strong>
                  <span className="text-muted-foreground ml-2">Tenant identifier</span>
                </div>
                <div>
                  <strong className="text-foreground">iat:</strong>
                  <span className="text-muted-foreground ml-2">Issued at (timestamp)</span>
                </div>
                <div>
                  <strong className="text-foreground">exp:</strong>
                  <span className="text-muted-foreground ml-2">Expires at (timestamp)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Using Tokens in Requests
              </CardTitle>
              <CardDescription>How to include authentication tokens in API calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Include the JWT token in the Authorization header using the Bearer scheme:
              </p>
              <CodeBlock 
                code={`curl -X POST https://mtvwmyerntkhrcdnhahp.supabase.co/functions/v1/admin-api-operations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \\
  -d '{"action": "list", "resource": "products"}'`}
                language="bash"
              />
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security Note:</strong> Never expose your tokens in client-side code or version control. Store tokens securely and transmit only over HTTPS.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token Expiration & Refresh</CardTitle>
              <CardDescription>Managing token lifecycle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Token Lifetime</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Tokens expire after 8 hours for security. You'll receive a 401 Unauthorized response when a token expires.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Handling Expiration</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  When you receive a 401 response, re-authenticate to obtain a new token:
                </p>
                <CodeBlock 
                  code={`// JavaScript example
const makeAuthenticatedRequest = async () => {
  try {
    const response = await fetch(apiUrl, {
      headers: { 'Authorization': \`Bearer \${token}\` }
    });
    
    if (response.status === 401) {
      // Token expired, re-authenticate
      const newToken = await authenticate();
      // Retry the request with new token
      return makeAuthenticatedRequest();
    }
    
    return response.json();
  } catch (error) {
    logger.error('Request failed:', error);
  }
};`}
                  language="javascript"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best Practices</CardTitle>
              <CardDescription>Security recommendations for authentication</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Store tokens securely:</strong>
                    <span className="text-muted-foreground ml-1">Use secure storage mechanisms like HTTP-only cookies or secure key stores</span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Use HTTPS only:</strong>
                    <span className="text-muted-foreground ml-1">Never transmit tokens over unencrypted connections</span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Implement token rotation:</strong>
                    <span className="text-muted-foreground ml-1">Regularly refresh tokens before expiration</span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Monitor for suspicious activity:</strong>
                    <span className="text-muted-foreground ml-1">Track failed authentication attempts and unusual patterns</span>
                  </div>
                </li>
                <li className="flex gap-3">
                  <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">Implement rate limiting:</strong>
                    <span className="text-muted-foreground ml-1">Protect against brute force attacks</span>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </DocsLayout>
    </>
  );
}
