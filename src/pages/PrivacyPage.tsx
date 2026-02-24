import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Eye, Lock, Database, Mail, AlertCircle } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <ModernPage
      title="Privacy Policy"
      description="How we protect and handle your data"
      backButton
      showLogo
    >
      <div className="space-y-6">
        {/* Last Updated */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Last updated: November 3, 2025
            </div>
          </CardContent>
        </Card>

        {/* Information We Collect */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Information We Collect</h3>
                <p className="text-sm text-muted-foreground">What data we gather and why</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <p><strong>Account Information:</strong> Name, email, phone number, business details</p>
              <p><strong>Business Data:</strong> Orders, customers, inventory, financial transactions</p>
              <p><strong>Usage Data:</strong> How you interact with the platform, feature usage</p>
              <p><strong>Device Information:</strong> IP address, browser type, device type</p>
              <p><strong>Location Data:</strong> GPS coordinates for delivery tracking (with permission)</p>
            </div>
          </CardContent>
        </Card>

        {/* How We Use Your Data */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">How We Use Your Data</h3>
                <p className="text-sm text-muted-foreground">Why we need your information</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm list-disc list-inside">
              <li>Provide and maintain our services</li>
              <li>Process transactions and send notifications</li>
              <li>Improve and personalize your experience</li>
              <li>Analyze usage patterns and optimize features</li>
              <li>Communicate updates, offers, and support</li>
              <li>Detect and prevent fraud or security issues</li>
              <li>Comply with legal obligations</li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Security */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Data Security</h3>
                <p className="text-sm text-muted-foreground">How we protect your information</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <p><strong>Encryption:</strong> All data is encrypted in transit (SSL/TLS) and at rest (AES-256)</p>
              <p><strong>Access Controls:</strong> Role-based permissions, multi-factor authentication</p>
              <p><strong>Infrastructure:</strong> Hosted on secure cloud servers with regular backups</p>
              <p><strong>Monitoring:</strong> 24/7 security monitoring and intrusion detection</p>
              <p><strong>Compliance:</strong> SOC 2 Type II, GDPR, CCPA compliant</p>
            </div>
          </CardContent>
        </Card>

        {/* Data Sharing */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Data Sharing & Disclosure</h3>
                <p className="text-sm text-muted-foreground">When we share your information</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li><strong>Service Providers:</strong> Payment processors, SMS providers, cloud hosting (under strict contracts)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect rights</li>
              <li><strong>Business Transfers:</strong> In case of merger, acquisition, or sale</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize sharing</li>
            </ul>
            <p className="text-sm font-medium">We NEVER sell your data to third parties.</p>
          </CardContent>
        </Card>

        {/* Your Rights */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Your Rights</h3>
                <p className="text-sm text-muted-foreground">Control over your data</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm list-disc list-inside">
              <li><strong>Access:</strong> Request a copy of your data</li>
              <li><strong>Correction:</strong> Update inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Export:</strong> Download your data in a portable format</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Object:</strong> Object to certain data processing activities</li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-lg">Data Retention</h3>
            <p className="text-sm">
              We retain your data for as long as your account is active or as needed to provide services.
              After account deletion, we keep data for 90 days for recovery, then permanently delete it.
              Some data may be retained longer for legal or compliance purposes.
            </p>
          </CardContent>
        </Card>

        {/* Children's Privacy */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-lg">Children's Privacy</h3>
            <p className="text-sm">
              Our services are not intended for anyone under 21 years of age. We do not knowingly collect
              personal information from minors. If you believe we have collected data from a minor,
              please contact us immediately.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Contact Us</h3>
                <p className="text-sm text-muted-foreground">Questions about privacy?</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p>Email: privacy@floraiq.com</p>
              <p>Phone: (555) 123-4567</p>
              <p>Address: 123 Main Street, New York, NY 10001</p>
            </div>
          </CardContent>
        </Card>

        {/* Updates */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              We may update this privacy policy from time to time. We'll notify you of significant changes
              via email or through the platform. Continued use of our services after changes indicates
              acceptance of the updated policy.
            </p>
          </CardContent>
        </Card>
      </div>
    </ModernPage>
  );
}

