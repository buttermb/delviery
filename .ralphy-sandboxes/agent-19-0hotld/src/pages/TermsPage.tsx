import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, AlertCircle, Scale, Ban, CreditCard } from 'lucide-react';

export default function TermsPage() {
  return (
    <ModernPage
      title="Terms of Service"
      description="Agreement for using FloraIQ"
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

        {/* Acceptance */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Acceptance of Terms</h3>
                <p className="text-sm text-muted-foreground">Agreement to use our services</p>
              </div>
            </div>
            <p className="text-sm">
              By accessing or using FloraIQ ("the Service"), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </CardContent>
        </Card>

        {/* Account Requirements */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-lg">Account Requirements</h3>
            <ul className="space-y-2 text-sm list-disc list-inside">
              <li>You must be at least 21 years old to use this Service</li>
              <li>You must provide accurate and complete registration information</li>
              <li>You are responsible for maintaining account security</li>
              <li>You may not share your account credentials</li>
              <li>You must have proper licenses to operate a wholesale business</li>
              <li>One account per business entity</li>
            </ul>
          </CardContent>
        </Card>

        {/* Acceptable Use */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Acceptable Use</h3>
                <p className="text-sm text-muted-foreground">How you may use the Service</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p><strong>You may:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Use the Service for lawful wholesale business operations</li>
                <li>Create and manage orders, inventory, and customers</li>
                <li>Access and export your business data</li>
                <li>Integrate with approved third-party services</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Prohibited Activities */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Ban className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Prohibited Activities</h3>
                <p className="text-sm text-muted-foreground">What you may NOT do</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm list-disc list-inside">
              <li>Violate any laws or regulations</li>
              <li>Sell to minors or unlicensed businesses</li>
              <li>Attempt to hack, disrupt, or compromise the Service</li>
              <li>Use the Service for fraudulent activities</li>
              <li>Scrape or harvest data from the platform</li>
              <li>Resell or redistribute the Service without authorization</li>
              <li>Upload malware, viruses, or harmful code</li>
              <li>Impersonate another user or business</li>
            </ul>
          </CardContent>
        </Card>

        {/* Payment Terms */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Payment Terms</h3>
                <p className="text-sm text-muted-foreground">Billing and subscription</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm list-disc list-inside">
              <li>Subscription fees are billed monthly or annually in advance</li>
              <li>Prices may change with 30 days notice</li>
              <li>No refunds for partial months or unused time</li>
              <li>Failed payments may result in service suspension</li>
              <li>You're responsible for all applicable taxes</li>
              <li>Payment information must be kept current</li>
            </ul>
          </CardContent>
        </Card>

        {/* Cancellation */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-lg">Cancellation & Termination</h3>
            <div className="space-y-3 text-sm">
              <p><strong>By You:</strong> You may cancel your subscription at any time. Access continues until the end of your billing period.</p>
              <p><strong>By Us:</strong> We may suspend or terminate your account for:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Violation of these terms</li>
                <li>Fraudulent or illegal activity</li>
                <li>Non-payment</li>
                <li>Inactivity for 12+ months</li>
              </ul>
              <p><strong>Data Retention:</strong> After cancellation, your data is retained for 90 days, then permanently deleted.</p>
            </div>
          </CardContent>
        </Card>

        {/* Intellectual Property */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-lg">Intellectual Property</h3>
            <p className="text-sm">
              The Service, including all software, design, content, and trademarks, is owned by FloraIQ
              Wholesale and protected by copyright and trademark laws. You receive a limited,
              non-exclusive, non-transferable license to use the Service. You retain ownership of your data.
            </p>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-lg">Disclaimer of Warranties</h3>
            <p className="text-sm">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE
              UNINTERRUPTED, ERROR-FREE, OR SECURE OPERATION. USE AT YOUR OWN RISK.
            </p>
          </CardContent>
        </Card>

        {/* Limitation of Liability */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-lg">Limitation of Liability</h3>
            <p className="text-sm">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS,
              DATA LOSS, OR BUSINESS INTERRUPTION, EVEN IF ADVISED OF THE POSSIBILITY.
            </p>
            <p className="text-sm">
              Our total liability shall not exceed the amount you paid us in the 12 months before the claim.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-lg">Contact Us</h3>
            <div className="space-y-2 text-sm">
              <p>For questions about these terms:</p>
              <p>Email: legal@floraiq.com</p>
              <p>Phone: (555) 123-4567</p>
              <p>Address: 123 Main Street, New York, NY 10001</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </ModernPage>
  );
}

