import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  AlertTriangle,
  Ban,
  Scale,
  FileWarning,
  Mail,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const EFFECTIVE_DATE = 'March 20, 2026';
const COMPANY_NAME = 'FloraIQ Inc.';
const SERVICE_NAME = 'FloraIQ';
const SUPPORT_EMAIL = 'legal@floraiq.com';

export default function AcceptableUsePage() {
  return (
    <ModernPage
      title="Acceptable Use Policy"
      description="Rules governing use of the FloraIQ platform"
      backButton
      showLogo
    >
      <div className="space-y-5 max-w-3xl mx-auto pb-12">
        {/* Effective Date */}
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/30 p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-sky-800 dark:text-sky-300">
                Effective Date: {EFFECTIVE_DATE}
              </p>
              <p className="text-sky-700 dark:text-sky-400">
                This Acceptable Use Policy (&quot;AUP&quot;) governs your use of {SERVICE_NAME} provided by {COMPANY_NAME}. This AUP supplements our Terms of Service and is incorporated by reference. Violation of this AUP may result in suspension or termination of your account.
              </p>
            </div>
          </div>
        </div>

        {/* 1. Purpose */}
        <Section
          icon={<Scale className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          title="1. Purpose"
        >
          <p className="text-sm">
            {SERVICE_NAME} is a software-as-a-service platform designed exclusively for <strong>licensed cannabis businesses</strong> operating in compliance with applicable state and local laws. This AUP defines acceptable and prohibited conduct to protect our users, maintain platform integrity, and ensure regulatory compliance.
          </p>
        </Section>

        {/* 2. Permitted Use */}
        <Section
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          title="2. Permitted Use"
        >
          <div className="space-y-3 text-sm">
            <p>You may use {SERVICE_NAME} only for lawful business purposes, including:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Managing inventory, orders, and deliveries for your <strong>licensed cannabis business</strong></li>
              <li>Creating and distributing digital menus and storefronts for products you are legally authorized to sell</li>
              <li>Processing wholesale and retail transactions in compliance with state and local regulations</li>
              <li>Communicating with verified customers and business partners</li>
              <li>Generating reports, analytics, and business intelligence for your operations</li>
              <li>Using AI-powered features for operational insights (subject to the AI disclaimer)</li>
            </ul>
          </div>
        </Section>

        {/* 3. Prohibited Activities */}
        <Section
          icon={<Ban className="h-5 w-5 text-red-600 dark:text-red-400" />}
          iconBg="bg-red-50 dark:bg-red-950/50"
          title="3. Prohibited Activities"
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="destructive" className="text-xs">Strictly Forbidden</Badge>
            </div>

            <p><strong>3.1 Licensing Violations</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Operating without valid state or local cannabis business licenses</li>
              <li>Selling, distributing, or facilitating transactions for <strong>unlicensed operators</strong></li>
              <li>Misrepresenting your licensing status or providing falsified license documentation</li>
              <li>Operating in jurisdictions where cannabis commerce is prohibited</li>
            </ul>

            <p><strong>3.2 Product Compliance Violations</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Listing products that fail to meet state testing or labeling requirements</li>
              <li>Advertising products with unapproved health claims (medical, therapeutic, or curative)</li>
              <li>Selling products exceeding legal THC limits or containing prohibited substances</li>
              <li>Distributing products without required lab test results (Certificates of Analysis)</li>
            </ul>

            <p><strong>3.3 Age &amp; Access Violations</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Selling or delivering cannabis products to individuals under the legal age (21+)</li>
              <li>Circumventing age verification or identity checks</li>
              <li>Allowing minors to access your storefront or place orders</li>
            </ul>

            <p><strong>3.4 Platform Abuse</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Attempting to reverse-engineer, decompile, or extract source code from the Service</li>
              <li>Using automated tools (bots, scrapers) to access the Service without authorization</li>
              <li>Interfering with or disrupting the Service, servers, or connected networks</li>
              <li>Uploading malicious code, viruses, or harmful content</li>
              <li>Impersonating other users, businesses, or {COMPANY_NAME} personnel</li>
              <li>Using the Service for money laundering, fraud, or other financial crimes</li>
            </ul>

            <p><strong>3.5 Data &amp; Privacy Violations</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Collecting, harvesting, or mining customer data for unauthorized purposes</li>
              <li>Sharing customer personal information with third parties without consent</li>
              <li>Using customer data for marketing purposes outside of the Service</li>
              <li>Failing to comply with applicable data protection laws (GDPR, CCPA/CPRA)</li>
            </ul>

            <p><strong>3.6 Content Violations</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Posting content that promotes illegal drug use or trafficking</li>
              <li>Publishing defamatory, harassing, or threatening content</li>
              <li>Uploading infringing copyrighted or trademarked material</li>
              <li>Creating misleading product listings or deceptive business practices</li>
            </ul>
          </div>
        </Section>

        {/* 4. Cannabis-Specific Obligations */}
        <Section
          icon={<Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          title="4. Cannabis-Specific Obligations"
        >
          <div className="space-y-3 text-sm">
            <p>As a user of a cannabis industry platform, you have additional obligations:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Maintain valid licenses:</strong> You must keep all required state and local licenses current and in good standing. You agree to notify us within 5 business days of any license suspension, revocation, or material change.</li>
              <li><strong>Track-and-trace compliance:</strong> If your jurisdiction requires seed-to-sale tracking (e.g., METRC, BioTrack), you must maintain compliance with those systems independently.</li>
              <li><strong>Tax compliance:</strong> You are solely responsible for collecting and remitting all applicable cannabis excise taxes, sales taxes, and other levies.</li>
              <li><strong>Transportation compliance:</strong> All deliveries must comply with state transportation regulations, including manifest requirements, vehicle requirements, and delivery hour restrictions.</li>
              <li><strong>Advertising compliance:</strong> All marketing content must comply with state advertising restrictions for cannabis products, including prohibition on marketing to minors.</li>
            </ul>
          </div>
        </Section>

        {/* 5. Enforcement */}
        <Section
          icon={<FileWarning className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          title="5. Enforcement"
        >
          <div className="space-y-3 text-sm">
            <p>{COMPANY_NAME} reserves the right to investigate and take action on any suspected violations of this AUP. Enforcement actions may include, at our sole discretion:</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <span><strong>Warning:</strong> Written notice for first-time or minor violations, with a remediation period.</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <span><strong>Suspension:</strong> Temporary account suspension pending investigation or remediation.</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <span><strong>Termination:</strong> Permanent account termination for serious, repeated, or willful violations.</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-800 mt-0.5 flex-shrink-0" />
                <span><strong>Reporting:</strong> Referral to law enforcement or regulatory authorities where required by law or where we reasonably believe illegal activity has occurred.</span>
              </li>
            </ul>
            <p className="text-muted-foreground">
              We may request proof of valid business licenses at any time. Failure to provide documentation within 10 business days of a request may result in account suspension.
            </p>
          </div>
        </Section>

        {/* 6. Reporting Violations */}
        <Section
          icon={<AlertTriangle className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          iconBg="bg-teal-50 dark:bg-teal-950/50"
          title="6. Reporting Violations"
        >
          <div className="space-y-3 text-sm">
            <p>If you become aware of any violation of this AUP, please report it to us immediately at <strong>{SUPPORT_EMAIL}</strong>. We take all reports seriously and investigate promptly. You will not be retaliated against for reporting a good-faith concern.</p>
          </div>
        </Section>

        {/* 7. Changes */}
        <Section
          icon={<Scale className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
          iconBg="bg-gray-100 dark:bg-gray-800"
          title="7. Changes to This Policy"
        >
          <p className="text-sm">
            We may update this AUP from time to time. Material changes will be communicated via email or in-app notification at least 15 days before they take effect. Continued use of the Service after the updated AUP becomes effective constitutes acceptance of the changes.
          </p>
        </Section>

        {/* Contact */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center">
                <Mail className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="font-semibold text-lg">Contact Us</h3>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>For questions about this Acceptable Use Policy:</p>
              <p className="font-medium text-foreground">{COMPANY_NAME}</p>
              <p>Email: {SUPPORT_EMAIL}</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground px-4">
          By using {SERVICE_NAME}, you acknowledge that you have read and agree to comply with this Acceptable Use Policy.
        </p>
      </div>
    </ModernPage>
  );
}

function Section({
  icon,
  iconBg,
  title,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
          <h3 className="font-semibold text-lg">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
