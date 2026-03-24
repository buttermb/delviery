import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield,
  Database,
  Lock,
  Globe,
  AlertTriangle,
  Users,
  FileCheck,
  Mail,
  Server,
} from 'lucide-react';

const EFFECTIVE_DATE = 'March 20, 2026';
const COMPANY_NAME = 'FloraIQ Inc.';
const SERVICE_NAME = 'FloraIQ';
const DPO_EMAIL = 'dpo@floraiq.com';

export default function DPAPage() {
  return (
    <ModernPage
      title="Data Processing Agreement"
      description="GDPR Article 28 compliant data processing terms"
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
                This Data Processing Agreement (&quot;DPA&quot;) forms part of the Terms of Service between {COMPANY_NAME} (&quot;Processor&quot;, &quot;we&quot;, &quot;us&quot;) and the customer (&quot;Controller&quot;, &quot;you&quot;) for the provision of {SERVICE_NAME}. This DPA is entered into pursuant to Article 28 of the General Data Protection Regulation (EU) 2016/679 (&quot;GDPR&quot;).
              </p>
            </div>
          </div>
        </div>

        {/* 1. Definitions */}
        <Section
          icon={<FileCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          title="1. Definitions"
        >
          <div className="space-y-2 text-sm">
            <p><strong>&quot;Personal Data&quot;</strong> means any information relating to an identified or identifiable natural person as defined in Article 4(1) GDPR.</p>
            <p><strong>&quot;Processing&quot;</strong> means any operation performed on Personal Data, including collection, recording, organization, structuring, storage, adaptation, retrieval, consultation, use, disclosure, erasure, or destruction.</p>
            <p><strong>&quot;Data Subject&quot;</strong> means the identified or identifiable natural person to whom Personal Data relates.</p>
            <p><strong>&quot;Sub-Processor&quot;</strong> means any third party engaged by {COMPANY_NAME} to process Personal Data on behalf of the Controller.</p>
            <p><strong>&quot;Data Breach&quot;</strong> means a breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data.</p>
          </div>
        </Section>

        {/* 2. Scope of Processing */}
        <Section
          icon={<Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          title="2. Scope of Processing"
        >
          <div className="space-y-3 text-sm">
            <p><strong>Subject matter:</strong> Provision of the {SERVICE_NAME} cannabis operations SaaS platform.</p>
            <p><strong>Duration:</strong> For the term of the service agreement plus any retention period required by law.</p>
            <p><strong>Nature and purpose:</strong> Processing Personal Data to provide inventory management, order processing, customer relationship management, analytics, and delivery coordination services.</p>

            <p className="font-semibold mt-4">Categories of Data Subjects:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Controller&apos;s employees and team members</li>
              <li>Controller&apos;s customers (end consumers)</li>
              <li>Controller&apos;s suppliers and vendors</li>
              <li>Delivery drivers and couriers</li>
            </ul>

            <p className="font-semibold mt-4">Categories of Personal Data:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Identifiers (name, email, phone number, address)</li>
              <li>Commercial information (order history, transaction records)</li>
              <li>Geolocation data (delivery addresses, route data)</li>
              <li>Professional information (business license details, role)</li>
              <li>Financial data (payment information processed via Stripe)</li>
              <li>Device and usage data (IP address, browser type, session data)</li>
            </ul>
          </div>
        </Section>

        {/* 3. Obligations of the Processor */}
        <Section
          icon={<Lock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          title="3. Obligations of the Processor"
        >
          <div className="space-y-3 text-sm">
            <p>{COMPANY_NAME} shall:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Process Personal Data only on documented instructions from the Controller, unless required by EU or Member State law (Article 28(3)(a) GDPR).</li>
              <li>Ensure that persons authorized to process Personal Data are bound by confidentiality obligations (Article 28(3)(b) GDPR).</li>
              <li>Implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk (Article 28(3)(c) and Article 32 GDPR).</li>
              <li>Respect the conditions for engaging Sub-Processors as outlined in Section 5 (Article 28(3)(d) GDPR).</li>
              <li>Assist the Controller in responding to Data Subject rights requests (Article 28(3)(e) GDPR).</li>
              <li>Assist the Controller in ensuring compliance with security, breach notification, impact assessment, and prior consultation obligations (Article 28(3)(f) GDPR).</li>
              <li>At the Controller&apos;s choice, delete or return all Personal Data upon termination of services (Article 28(3)(g) GDPR).</li>
              <li>Make available all information necessary to demonstrate compliance and allow for audits (Article 28(3)(h) GDPR).</li>
            </ul>
          </div>
        </Section>

        {/* 4. Security Measures */}
        <Section
          icon={<Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-50 dark:bg-violet-950/50"
          title="4. Security Measures"
        >
          <div className="space-y-3 text-sm">
            <p>We implement the following technical and organizational security measures (Article 32 GDPR):</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Encryption:</strong> AES-256 encryption at rest; TLS 1.3 in transit.</li>
              <li><strong>Access controls:</strong> Role-based access control (RBAC), multi-factor authentication (MFA), and least-privilege principles.</li>
              <li><strong>Row-Level Security:</strong> Supabase RLS policies enforce tenant isolation at the database level.</li>
              <li><strong>Monitoring:</strong> Real-time security monitoring, audit logging, and anomaly detection.</li>
              <li><strong>Incident response:</strong> Documented incident response plan with 72-hour breach notification.</li>
              <li><strong>Business continuity:</strong> Automated backups, disaster recovery procedures, and redundant infrastructure.</li>
              <li><strong>Employee training:</strong> Regular security awareness training for all personnel with access to Personal Data.</li>
              <li><strong>Penetration testing:</strong> Regular security assessments and vulnerability scanning.</li>
            </ul>
          </div>
        </Section>

        {/* 5. Sub-Processors */}
        <Section
          icon={<Server className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          iconBg="bg-cyan-50 dark:bg-cyan-950/50"
          title="5. Sub-Processors"
        >
          <div className="space-y-3 text-sm">
            <p>The Controller provides general written authorization for {COMPANY_NAME} to engage Sub-Processors. We maintain the following Sub-Processors:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-semibold">Sub-Processor</th>
                    <th className="py-2 pr-4 font-semibold">Purpose</th>
                    <th className="py-2 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-2 pr-4">Supabase Inc.</td><td className="py-2 pr-4">Database hosting, authentication, real-time</td><td className="py-2">US (AWS)</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">Vercel Inc.</td><td className="py-2 pr-4">Application hosting, CDN, edge functions</td><td className="py-2">US / Global Edge</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">Stripe Inc.</td><td className="py-2 pr-4">Payment processing, billing</td><td className="py-2">US</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">Cloudflare Inc.</td><td className="py-2 pr-4">DDoS protection, CDN, bot management</td><td className="py-2">US / Global Edge</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">Mapbox Inc.</td><td className="py-2 pr-4">Map rendering, geocoding, route optimization</td><td className="py-2">US</td></tr>
                  <tr><td className="py-2 pr-4">Anthropic PBC</td><td className="py-2 pr-4">AI/ML features (opt-in only)</td><td className="py-2">US</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground">
              We will notify you of any intended changes to Sub-Processors at least 30 days in advance, giving you the opportunity to object. If you reasonably object and we cannot accommodate the objection, you may terminate the affected services.
            </p>
          </div>
        </Section>

        {/* 6. Data Transfers */}
        <Section
          icon={<Globe className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          iconBg="bg-teal-50 dark:bg-teal-950/50"
          title="6. International Data Transfers"
        >
          <div className="space-y-3 text-sm">
            <p>Personal Data may be transferred to countries outside the European Economic Area (EEA). For such transfers, we rely on:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>EU-US Data Privacy Framework:</strong> For transfers to certified US organizations.</li>
              <li><strong>Standard Contractual Clauses (SCCs):</strong> EU Commission-approved SCCs (Commission Implementing Decision 2021/914) for transfers to countries without adequacy decisions.</li>
              <li><strong>Transfer Impact Assessments:</strong> We conduct and maintain transfer impact assessments for each transfer mechanism.</li>
            </ul>
            <p>Upon request, we will provide copies of the relevant SCCs and transfer impact assessments.</p>
          </div>
        </Section>

        {/* 7. Data Breach Notification */}
        <Section
          icon={<AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          title="7. Data Breach Notification"
        >
          <div className="space-y-3 text-sm">
            <p>In the event of a Data Breach, {COMPANY_NAME} shall:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Notify the Controller <strong>without undue delay</strong> and in any event within <strong>48 hours</strong> of becoming aware of the breach (ahead of the 72-hour GDPR requirement).</li>
              <li>Provide sufficient information for the Controller to fulfill its own breach notification obligations under Articles 33 and 34 GDPR, including: the nature of the breach, categories and approximate number of Data Subjects affected, likely consequences, and measures taken or proposed.</li>
              <li>Cooperate with the Controller and take reasonable steps to assist in the investigation, mitigation, and remediation of the breach.</li>
              <li>Document all Data Breaches, including facts, effects, and remedial actions taken.</li>
            </ul>
          </div>
        </Section>

        {/* 8. Data Subject Rights */}
        <Section
          icon={<Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-50 dark:bg-orange-950/50"
          title="8. Data Subject Rights"
        >
          <div className="space-y-3 text-sm">
            <p>{COMPANY_NAME} shall assist the Controller in responding to Data Subject requests under Chapter III GDPR, including:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Right of access (Article 15)</li>
              <li>Right to rectification (Article 16)</li>
              <li>Right to erasure (Article 17)</li>
              <li>Right to restriction of processing (Article 18)</li>
              <li>Right to data portability (Article 20)</li>
              <li>Right to object (Article 21)</li>
            </ul>
            <p>{SERVICE_NAME} provides self-service tools for data export and account deletion. For requests we cannot fulfill through the platform, we will respond within 10 business days.</p>
          </div>
        </Section>

        {/* 9. Audits */}
        <Section
          icon={<FileCheck className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          title="9. Audits &amp; Compliance"
        >
          <div className="space-y-3 text-sm">
            <p>{COMPANY_NAME} shall make available to the Controller all information necessary to demonstrate compliance with Article 28 GDPR and allow for audits, including inspections, conducted by the Controller or an auditor mandated by the Controller.</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Audits shall be conducted with reasonable notice (minimum 30 days) and during normal business hours.</li>
              <li>The Controller shall bear the cost of any audit.</li>
              <li>We will provide SOC 2 reports, penetration test summaries, and other compliance documentation upon request.</li>
              <li>Where an audit reveals a material non-compliance, we will remediate at our own cost within a reasonable timeframe.</li>
            </ul>
          </div>
        </Section>

        {/* 10. Termination */}
        <Section
          icon={<Database className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
          iconBg="bg-gray-100 dark:bg-gray-800"
          title="10. Data Deletion &amp; Return"
        >
          <div className="space-y-3 text-sm">
            <p>Upon termination of the service agreement:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>At the Controller&apos;s election, we will <strong>delete or return</strong> all Personal Data within 30 days.</li>
              <li>Data export is available in standard formats (CSV, JSON) via the platform&apos;s data export feature.</li>
              <li>We will certify deletion in writing upon request.</li>
              <li>We may retain Personal Data to the extent required by applicable law, and such retained data will continue to be protected under this DPA.</li>
            </ul>
          </div>
        </Section>

        {/* Contact */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center">
                <Mail className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="font-semibold text-lg">Data Protection Officer</h3>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>For questions about this DPA or data processing practices:</p>
              <p className="font-medium text-foreground">{COMPANY_NAME}</p>
              <p>Email: {DPO_EMAIL}</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground px-4">
          This DPA is governed by the same governing law as the Terms of Service. In the event of a conflict between this DPA and the Terms of Service, this DPA shall prevail with respect to data protection matters.
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
