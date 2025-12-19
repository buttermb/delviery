import { SEOHead } from "@/components/SEOHead";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Shield, Lock, Eye, AlertTriangle, FileCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function SecurityPage() {
  return (
    <>
      <SEOHead 
        title="Security - API Documentation - DevPanel"
        description="Learn about DevPanel's security features, best practices, and compliance standards."
      />
      
      <DocsLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-4 text-foreground">Security</h1>
            <p className="text-lg text-muted-foreground">
              DevPanel is built with security at its core. Learn about our security measures, compliance standards, and best practices.
            </p>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Security First:</strong> All API communication uses TLS 1.2+ encryption. We follow OWASP security guidelines and conduct regular security audits.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Data Encryption
              </CardTitle>
              <CardDescription>How we protect your data in transit and at rest</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Encryption in Transit</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  All API requests must use HTTPS with TLS 1.2 or higher. We reject all HTTP requests to ensure data is always encrypted during transmission.
                </p>
                <CodeBlock 
                  code="# All requests must use HTTPS\nhttps://aejugtmhwwknrowfyzie.supabase.co/functions/v1/...\n\n# HTTP requests will be rejected\nhttp://... ❌"
                  language="text"
                />
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Encryption at Rest</h4>
                <p className="text-sm text-muted-foreground">
                  All data stored in our databases is encrypted using AES-256 encryption. Sensitive fields like passwords are additionally hashed using bcrypt.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Row Level Security (RLS)
              </CardTitle>
              <CardDescription>Database-level access control</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                DevPanel implements Row Level Security policies to ensure users can only access data they're authorized to see:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span className="text-muted-foreground">Tenant isolation: Each tenant can only access their own data</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span className="text-muted-foreground">Role-based access: Admins, staff, and customers have different permissions</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span className="text-muted-foreground">Customer data protection: Customers can only access their own orders and information</span>
                </li>
              </ul>
              <CodeBlock 
                code={`-- Example RLS Policy
CREATE POLICY "Users can view their own orders"
ON orders FOR SELECT
USING (auth.uid() = user_id AND tenant_id = get_tenant_id());`}
                language="sql"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Rate Limiting
              </CardTitle>
              <CardDescription>Protecting against abuse and ensuring fair usage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Default Limits</h4>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-semibold text-foreground mb-1">Authentication</div>
                    <div className="text-muted-foreground">5 requests/minute</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-semibold text-foreground mb-1">Read Operations</div>
                    <div className="text-muted-foreground">100 requests/minute</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-semibold text-foreground mb-1">Write Operations</div>
                    <div className="text-muted-foreground">50 requests/minute</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-semibold text-foreground mb-1">AI Features</div>
                    <div className="text-muted-foreground">10 requests/minute</div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Rate Limit Headers</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  API responses include rate limit information in headers:
                </p>
                <CodeBlock 
                  code={`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1704067200`}
                  language="text"
                />
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  When rate limits are exceeded, you'll receive a <code className="text-xs">429 Too Many Requests</code> response. Wait until the reset time before retrying.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                Audit Logging
              </CardTitle>
              <CardDescription>Comprehensive activity tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                All API operations are logged for security and compliance. Audit logs include:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span className="text-muted-foreground">Authentication events (login, logout, failed attempts)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span className="text-muted-foreground">Resource modifications (create, update, delete operations)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span className="text-muted-foreground">Timestamp, user ID, IP address, and user agent</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span className="text-muted-foreground">Request details and response status</span>
                </li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Tenant admins can access audit logs through the admin dashboard. Logs are retained for 90 days on Professional plans and 1 year on Enterprise plans.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Best Practices</CardTitle>
              <CardDescription>Recommendations for secure API integration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Token Management
                  </h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground ml-6">
                    <li>• Never commit tokens to version control</li>
                    <li>• Store tokens in secure environment variables or secret managers</li>
                    <li>• Rotate tokens regularly (at least every 8 hours)</li>
                    <li>• Use separate tokens for development, staging, and production</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Input Validation
                  </h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground ml-6">
                    <li>• Validate all input data before sending to the API</li>
                    <li>• Sanitize user input to prevent injection attacks</li>
                    <li>• Use parameterized queries when building requests</li>
                    <li>• Implement client-side validation as a first line of defense</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Error Handling
                  </h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground ml-6">
                    <li>• Don't expose sensitive error details to end users</li>
                    <li>• Log errors securely for debugging</li>
                    <li>• Implement proper error handling for all API calls</li>
                    <li>• Use generic error messages in production</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Network Security
                  </h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground ml-6">
                    <li>• Always use HTTPS for API requests</li>
                    <li>• Implement certificate pinning in mobile apps</li>
                    <li>• Use VPNs or private networks when possible</li>
                    <li>• Monitor and log all API traffic</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance & Certifications</CardTitle>
              <CardDescription>Industry standards we adhere to</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-semibold mb-2 text-foreground">SOC 2 Type II</h4>
                  <p className="text-sm text-muted-foreground">
                    Third-party audited security controls and processes
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-semibold mb-2 text-foreground">GDPR Compliant</h4>
                  <p className="text-sm text-muted-foreground">
                    Full compliance with EU data protection regulations
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-semibold mb-2 text-foreground">CCPA Compliant</h4>
                  <p className="text-sm text-muted-foreground">
                    California Consumer Privacy Act compliance
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <h4 className="font-semibold mb-2 text-foreground">PCI DSS</h4>
                  <p className="text-sm text-muted-foreground">
                    Payment Card Industry Data Security Standard
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Report Security Issues
              </CardTitle>
              <CardDescription>
                Found a security vulnerability? Please report it responsibly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Email: <a href="mailto:security@devpanel.com" className="text-primary hover:underline">security@devpanel.com</a>
              </p>
              <p className="text-sm text-muted-foreground">
                We take security seriously and will respond to all legitimate reports within 24 hours.
              </p>
            </CardContent>
          </Card>
        </div>
      </DocsLayout>
    </>
  );
}
