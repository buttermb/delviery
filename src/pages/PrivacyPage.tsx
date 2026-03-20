import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Eye,
  Lock,
  Database,
  Mail,
  AlertTriangle,
  Globe,
  Cookie,
  UserCheck,
  Clock,
  Bell,
  Scale,
  Server,
  FileText,
} from 'lucide-react';

const EFFECTIVE_DATE = 'March 20, 2026';
const COMPANY_NAME = 'FloraIQ Inc.';
const SERVICE_NAME = 'FloraIQ';
const PRIVACY_EMAIL = 'privacy@floraiq.com';
const JURISDICTION = 'New York, New York';

export default function PrivacyPage() {
  return (
    <ModernPage
      title="Privacy Policy"
      description="How we collect, use, and protect your information"
      backButton
      showLogo
    >
      <div className="space-y-5 max-w-3xl mx-auto pb-12">
        {/* Effective Date & Notice */}
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/30 p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-sky-800 dark:text-sky-300">
                Effective Date: {EFFECTIVE_DATE}
              </p>
              <p className="text-sky-700 dark:text-sky-400">
                This Privacy Policy describes how {COMPANY_NAME} (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) collects, uses, stores, discloses, and protects your personal information when you use {SERVICE_NAME}. By using our Service, you consent to the practices described herein.
              </p>
            </div>
          </div>
        </div>

        {/* 1. Information We Collect */}
        <Section
          icon={<Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          title="1. Information We Collect"
        >
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold mb-1.5">Information You Provide:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Account registration data (name, email address, phone number, business name)</li>
                <li>Business information (licenses, permits, business type, company size)</li>
                <li>Business data entered into the Service (orders, inventory, customer records, financial transactions)</li>
                <li>Payment and billing information (processed by our third-party payment processor; we do not store full payment card numbers)</li>
                <li>Communications with us (support requests, emails, feedback)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1.5">Information Collected Automatically:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Device information (IP address, browser type, operating system, device identifiers)</li>
                <li>Usage data (pages visited, features used, click patterns, session duration)</li>
                <li>Log data (access times, error logs, referring URLs)</li>
                <li>Location data (approximate location derived from IP address; precise GPS location only with your explicit consent for delivery features)</li>
                <li>Cookies and similar tracking technologies (see Section 7)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1.5">Information From Third Parties:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Payment processor transaction confirmations</li>
                <li>Analytics and advertising partners</li>
                <li>Publicly available business information</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* 2. How We Use Your Information */}
        <Section
          icon={<Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          title="2. How We Use Your Information"
        >
          <p className="text-sm mb-3">We use the information we collect for the following purposes:</p>
          <ul className="space-y-1.5 text-sm list-disc list-inside">
            <li>Provide, operate, maintain, and improve the Service</li>
            <li>Process transactions, manage subscriptions, and send billing notifications</li>
            <li>Create and manage your account</li>
            <li>Personalize your experience and provide relevant features</li>
            <li>Analyze usage patterns, diagnose technical issues, and optimize performance</li>
            <li>Communicate with you about updates, security alerts, and support</li>
            <li>Send promotional communications (with your consent; you may opt out at any time)</li>
            <li>Detect, investigate, and prevent fraud, abuse, and security incidents</li>
            <li>Enforce our Terms of Service and protect our rights and property</li>
            <li>Comply with legal obligations and respond to lawful requests</li>
            <li>Aggregate and de-identify data for analytics, research, and product development</li>
          </ul>
        </Section>

        {/* 3. Legal Bases for Processing */}
        <Section
          icon={<Scale className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-50 dark:bg-violet-950/50"
          title="3. Legal Bases for Processing"
        >
          <p className="text-sm mb-3">We process your personal information based on the following legal grounds:</p>
          <ul className="space-y-2 text-sm">
            <li><strong>Contract Performance:</strong> Processing necessary to provide the Service you requested.</li>
            <li><strong>Legitimate Interests:</strong> Processing for our legitimate business interests (e.g., fraud prevention, security, product improvement), balanced against your rights.</li>
            <li><strong>Consent:</strong> Where you have given explicit consent (e.g., marketing communications, location tracking).</li>
            <li><strong>Legal Obligation:</strong> Processing required to comply with applicable laws and regulations.</li>
          </ul>
        </Section>

        {/* 4. Data Sharing & Disclosure */}
        <Section
          icon={<Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          title="4. Data Sharing &amp; Disclosure"
        >
          <p className="text-sm mb-3">We may share your information in the following circumstances:</p>
          <ul className="space-y-2 text-sm">
            <li><strong>Service Providers:</strong> Third-party vendors who assist in operating the Service (payment processing, email delivery, cloud hosting, analytics) under strict contractual obligations and data processing agreements.</li>
            <li><strong>Legal Requirements:</strong> When required by law, subpoena, court order, or governmental request; to protect our rights, safety, or property; to investigate fraud or security issues.</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, reorganization, bankruptcy, or sale of all or a portion of our assets. Your information may be transferred as part of such a transaction.</li>
            <li><strong>With Your Consent:</strong> When you explicitly authorize the sharing.</li>
            <li><strong>Aggregated/De-identified Data:</strong> We may share aggregated or de-identified data that cannot reasonably be used to identify you.</li>
          </ul>
          <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">We do NOT sell your personal information to third parties.</p>
          </div>
        </Section>

        {/* 5. Data Security */}
        <Section
          icon={<Lock className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          iconBg="bg-teal-50 dark:bg-teal-950/50"
          title="5. Data Security"
        >
          <div className="space-y-3 text-sm">
            <p>We implement industry-standard security measures to protect your information, including:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Encryption of data in transit (TLS/SSL) and at rest (AES-256)</li>
              <li>Role-based access controls and principle of least privilege</li>
              <li>Regular security assessments and monitoring</li>
              <li>Secure cloud infrastructure with geographic redundancy</li>
              <li>Incident response procedures</li>
            </ul>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Important:</strong> No method of transmission or storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security. You acknowledge and accept this inherent risk. You are responsible for maintaining the security of your account credentials.
              </p>
            </div>
          </div>
        </Section>

        {/* 6. Data Retention */}
        <Section
          icon={<Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-50 dark:bg-orange-950/50"
          title="6. Data Retention"
        >
          <div className="space-y-3 text-sm">
            <p>We retain your personal information for as long as necessary to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Provide the Service and maintain your account</li>
              <li>Comply with legal, accounting, and regulatory obligations</li>
              <li>Resolve disputes and enforce agreements</li>
              <li>Protect against fraud and abuse</li>
            </ul>
            <p>After account deletion, we may retain certain data for up to 90 days for recovery purposes, and longer as required by law (e.g., tax records, transaction logs). Aggregated or de-identified data may be retained indefinitely.</p>
            <p>Backup copies may persist in our systems for a reasonable period after deletion as part of standard data recovery procedures.</p>
          </div>
        </Section>

        {/* 7. Cookies & Tracking */}
        <Section
          icon={<Cookie className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          title="7. Cookies &amp; Tracking Technologies"
        >
          <div className="space-y-3 text-sm">
            <p>We use cookies, local storage, and similar technologies to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Essential Cookies:</strong> Maintain your session, authenticate your identity, and provide core functionality.</li>
              <li><strong>Functional Cookies:</strong> Remember your preferences and settings.</li>
              <li><strong>Analytics Cookies:</strong> Understand how users interact with the Service to improve it.</li>
            </ul>
            <p>You can manage cookie preferences through your browser settings. Disabling essential cookies may impair core Service functionality.</p>
            <p><strong>Do Not Track:</strong> We currently do not respond to &quot;Do Not Track&quot; browser signals, as there is no industry-standard protocol for compliance.</p>
          </div>
        </Section>

        {/* 8. Your Rights */}
        <Section
          icon={<UserCheck className="h-5 w-5 text-sky-600 dark:text-sky-400" />}
          iconBg="bg-sky-50 dark:bg-sky-950/50"
          title="8. Your Rights"
        >
          <p className="text-sm mb-3">Depending on your jurisdiction, you may have the following rights regarding your personal information:</p>
          <ul className="space-y-1.5 text-sm list-disc list-inside">
            <li><strong>Access:</strong> Request a copy of your personal data we hold.</li>
            <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal and contractual retention requirements.</li>
            <li><strong>Portability:</strong> Request your data in a structured, machine-readable format.</li>
            <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances.</li>
            <li><strong>Objection:</strong> Object to processing based on legitimate interests or for direct marketing.</li>
            <li><strong>Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent (without affecting prior processing).</li>
            <li><strong>Opt-Out of Marketing:</strong> Unsubscribe from marketing communications at any time via the link in any email or through your account settings.</li>
          </ul>
          <p className="text-sm mt-3 text-muted-foreground">
            To exercise any of these rights, contact us at {PRIVACY_EMAIL}. We will respond within the timeframe required by applicable law (typically 30 days). We may need to verify your identity before processing your request.
          </p>
        </Section>

        {/* 9. California Privacy Rights (CCPA) */}
        <Section
          icon={<FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
          iconBg="bg-rose-50 dark:bg-rose-950/50"
          title="9. California Privacy Rights (CCPA/CPRA)"
        >
          <div className="space-y-3 text-sm">
            <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA):</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Right to Know:</strong> Request information about the categories and specific pieces of personal information we have collected.</li>
              <li><strong>Right to Delete:</strong> Request deletion of your personal information, subject to exceptions.</li>
              <li><strong>Right to Correct:</strong> Request correction of inaccurate personal information.</li>
              <li><strong>Right to Opt-Out of Sale/Sharing:</strong> We do not sell or share your personal information for cross-context behavioral advertising.</li>
              <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</li>
            </ul>
            <p>To submit a request, email {PRIVACY_EMAIL} with the subject line &quot;CCPA Request.&quot;</p>
          </div>
        </Section>

        {/* 10. International Data Transfers */}
        <Section
          icon={<Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          iconBg="bg-cyan-50 dark:bg-cyan-950/50"
          title="10. International Data Transfers"
        >
          <p className="text-sm">
            Your information may be transferred to, stored, and processed in countries other than your country of residence, including the United States. These countries may have data protection laws that differ from your jurisdiction. By using the Service, you consent to the transfer of your information to these countries. Where required by applicable law, we implement appropriate safeguards (such as Standard Contractual Clauses) to protect your data during international transfers.
          </p>
        </Section>

        {/* 11. Children's Privacy */}
        <Section
          icon={<Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
          iconBg="bg-purple-50 dark:bg-purple-950/50"
          title="11. Children&apos;s Privacy"
        >
          <p className="text-sm">
            The Service is not intended for individuals under 21 years of age. We do not knowingly collect personal information from anyone under 21. If we become aware that we have collected personal information from a person under 21, we will take steps to delete that information promptly. If you believe we have inadvertently collected such information, please contact us immediately at {PRIVACY_EMAIL}.
          </p>
        </Section>

        {/* 12. Data Breach Notification */}
        <Section
          icon={<Bell className="h-5 w-5 text-red-600 dark:text-red-400" />}
          iconBg="bg-red-50 dark:bg-red-950/50"
          title="12. Data Breach Notification"
        >
          <p className="text-sm">
            In the event of a data breach that affects your personal information, we will notify you and the relevant supervisory authorities as required by applicable law. Notification will be provided via email and/or prominent notice on the Service within the timeframe required by law. The notification will describe the nature of the breach, the data affected, and the steps we are taking to address it.
          </p>
        </Section>

        {/* 13. Third-Party Links */}
        <Section
          icon={<Server className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          title="13. Third-Party Links &amp; Services"
        >
          <p className="text-sm">
            The Service may contain links to third-party websites or services that are not operated by us. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party sites or services. We strongly advise you to review the privacy policy of every site you visit. We are not liable for any loss or damage arising from your use of third-party services accessed through our platform.
          </p>
        </Section>

        {/* 14. Changes to This Policy */}
        <Section
          icon={<FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
          iconBg="bg-gray-100 dark:bg-gray-800"
          title="14. Changes to This Privacy Policy"
        >
          <p className="text-sm">
            We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of material changes by posting the updated policy on this page with a revised effective date, and by sending an email or in-app notification for significant changes. Your continued use of the Service after the updated policy becomes effective constitutes your acceptance of the changes. We encourage you to review this page periodically.
          </p>
        </Section>

        {/* Disclaimer */}
        <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-950/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-amber-900 dark:text-amber-200">Disclaimer</h3>
                <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 text-xs mt-1">IMPORTANT</Badge>
              </div>
            </div>
          </div>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm">
              WHILE WE IMPLEMENT REASONABLE SECURITY MEASURES, NO SYSTEM IS COMPLETELY SECURE. WE DO NOT WARRANT OR GUARANTEE THE SECURITY OF YOUR INFORMATION AND ARE NOT RESPONSIBLE FOR UNAUTHORIZED ACCESS RESULTING FROM FACTORS BEYOND OUR REASONABLE CONTROL, INCLUDING BUT NOT LIMITED TO YOUR OWN SECURITY PRACTICES, THIRD-PARTY BREACHES, OR FORCE MAJEURE EVENTS.
            </p>
            <p className="text-sm">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR LIABILITY FOR ANY PRIVACY-RELATED CLAIM SHALL BE LIMITED AS SET FORTH IN OUR TERMS OF SERVICE.
            </p>
          </CardContent>
        </div>

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
              <p>For questions, concerns, or requests regarding this Privacy Policy:</p>
              <p className="font-medium text-foreground">{COMPANY_NAME}</p>
              <p>Privacy Inquiries: {PRIVACY_EMAIL}</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground px-4">
          By using {SERVICE_NAME}, you acknowledge that you have read, understood, and agree to this Privacy Policy in its entirety.
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
