import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Shield from "lucide-react/dist/esm/icons/shield";
import Lock from "lucide-react/dist/esm/icons/lock";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Clock from "lucide-react/dist/esm/icons/clock";
import Flame from "lucide-react/dist/esm/icons/flame";
import Users from "lucide-react/dist/esm/icons/users";
import Eye from "lucide-react/dist/esm/icons/eye";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import BookOpen from "lucide-react/dist/esm/icons/book-open";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import { useNavigate } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DisposableMenusHelp = () => {
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <Button
        variant="ghost"
        onClick={() => navigateToAdmin('disposable-menus')}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Menus
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <BookOpen className="h-8 w-8 text-primary" />
          Disposable Menus Guide
        </h1>
        <p className="text-muted-foreground">
          Complete guide to creating and managing encrypted, self-destructing wholesale catalogs
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="best-practices">Best Practices</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">What are Disposable Menus?</h2>
            <p className="text-muted-foreground mb-4">
              Disposable Menus are encrypted, temporary wholesale catalogs designed for maximum
              security and control. Each menu has unique access controls and can be "burned"
              (destroyed) instantly if compromised.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Shield className="h-5 w-5 text-primary" />
                  Key Features
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground ml-7">
                  <li>• Encrypted URL tokens</li>
                  <li>• 6-digit access codes</li>
                  <li>• Device fingerprinting</li>
                  <li>• Geofencing support</li>
                  <li>• Time restrictions</li>
                  <li>• Instant burn capability</li>
                </ul>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <Users className="h-5 w-5 text-primary" />
                  Use Cases
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground ml-7">
                  <li>• VIP customer catalogs</li>
                  <li>• Limited-time offers</li>
                  <li>• Event-based sales</li>
                  <li>• Territory-specific pricing</li>
                  <li>• Sensitive product launches</li>
                  <li>• High-value transactions</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">Quick Start</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <div className="font-semibold">Create Menu</div>
                  <div className="text-sm text-muted-foreground">
                    Select products, set prices, configure security settings
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <div className="font-semibold">Invite Customers</div>
                  <div className="text-sm text-muted-foreground">
                    Add customers to whitelist, each gets unique access token
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <div className="font-semibold">Share Securely</div>
                  <div className="text-sm text-muted-foreground">
                    Send access links via WhatsApp or SMS with access codes
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <div className="font-semibold">Monitor & Burn</div>
                  <div className="text-sm text-muted-foreground">
                    Track access, receive alerts, burn if compromised
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              All security features work together to create multiple layers of protection.
              Enable features based on your security requirements.
            </AlertDescription>
          </Alert>

          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Encryption & Access Control
            </h3>
            <div className="space-y-4">
              <div>
                <div className="font-semibold mb-2">Encrypted URL Tokens</div>
                <p className="text-sm text-muted-foreground">
                  Each menu gets a cryptographically secure 256-bit token. Tokens are hashed
                  and stored securely, making them impossible to guess or brute force.
                </p>
              </div>

              <div>
                <div className="font-semibold mb-2">6-Digit Access Codes</div>
                <p className="text-sm text-muted-foreground">
                  Required for all menu access. Codes are randomly generated and hashed.
                  Failed attempts are logged and can trigger security alerts.
                </p>
              </div>

              <div>
                <div className="font-semibold mb-2">Device Fingerprinting</div>
                <p className="text-sm text-muted-foreground">
                  Creates unique identifier from device characteristics (browser, OS, screen,
                  timezone). Detects when different devices try to use the same access token.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Geofencing
            </h3>
            <p className="text-muted-foreground mb-4">
              Restrict menu access to specific geographic locations using GPS coordinates.
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Set center point (latitude/longitude)</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Define radius in kilometers</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Blocks access from outside area</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Logs all location violations</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Restrictions
            </h3>
            <p className="text-muted-foreground mb-4">
              Control when your menu can be accessed by setting allowed hours.
            </p>
            <div className="bg-muted/50 p-4 rounded-lg">
              <code className="text-sm">
                allowed_hours: &#123; start: 9, end: 17 &#125; // 9 AM to 5 PM only
              </code>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Burn Capabilities
            </h3>
            <div className="space-y-4">
              <div>
                <div className="font-semibold mb-2">Soft Burn</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Menu becomes inactive but data preserved</li>
                  <li>• Can auto-generate replacement menu</li>
                  <li>• Option to migrate customers to new menu</li>
                  <li>• Useful for compromised links</li>
                </ul>
              </div>

              <div>
                <div className="font-semibold mb-2">Hard Burn</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Permanent deletion of menu and all data</li>
                  <li>• Cannot be reversed</li>
                  <li>• All access immediately revoked</li>
                  <li>• Use for security breaches</li>
                </ul>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">Customer Access Flow</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 text-2xl">1️⃣</div>
                <div>
                  <div className="font-semibold">Customer receives link</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Via WhatsApp, SMS, or email: <code className="bg-muted px-1">/m/abc123?u=xyz789</code>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 text-2xl">2️⃣</div>
                <div>
                  <div className="font-semibold">Location check</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Browser requests GPS location (if geofencing enabled)
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 text-2xl">3️⃣</div>
                <div>
                  <div className="font-semibold">Enter access code</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Customer enters 6-digit code received separately
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 text-2xl">4️⃣</div>
                <div>
                  <div className="font-semibold">Validation</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    System validates: token, code, location, time, device, whitelist status
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 text-2xl">5️⃣</div>
                <div>
                  <div className="font-semibold">Browse & order</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    If approved, customer can view products and place orders
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Best Practices Tab */}
        <TabsContent value="best-practices" className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Following these practices will maximize security and minimize risks
            </AlertDescription>
          </Alert>

          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">Security Best Practices</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Always enable geofencing for high-value menus</div>
                  <div className="text-sm text-muted-foreground">
                    Prevents access from unexpected locations
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Set view limits to prevent sharing</div>
                  <div className="text-sm text-muted-foreground">
                    Limit how many times a menu can be viewed
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Monitor security events regularly</div>
                  <div className="text-sm text-muted-foreground">
                    Check for failed access attempts and violations
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Burn compromised menus immediately</div>
                  <div className="text-sm text-muted-foreground">
                    Don't wait - use soft burn to migrate customers if needed
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Send codes separately from links</div>
                  <div className="text-sm text-muted-foreground">
                    WhatsApp link, SMS code - two-factor security
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">Operational Best Practices</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Use descriptive menu names</div>
                  <div className="text-sm text-muted-foreground">
                    "VIP-Q4-2025" better than "Menu 1"
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Set appropriate order limits</div>
                  <div className="text-sm text-muted-foreground">
                    Min/max quantities prevent abuse
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Keep whitelist updated</div>
                  <div className="text-sm text-muted-foreground">
                    Revoke access for inactive customers
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Review analytics weekly</div>
                  <div className="text-sm text-muted-foreground">
                    Track conversion rates and customer behavior
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Test links before distributing</div>
                  <div className="text-sm text-muted-foreground">
                    Verify all settings work as expected
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DisposableMenusHelp;
