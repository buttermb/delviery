import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Lock,
  Key,
  Database,
  Eye,
  AlertTriangle,
  Server,
  CheckCircle,
  Bell,
  Mail,
} from 'lucide-react';

const EFFECTIVE_DATE = 'March 20, 2026';
const COMPANY_NAME = 'FloraIQ Inc.';
const SERVICE_NAME = 'FloraIQ';
const SECURITY_EMAIL = 'security@floraiq.com';

export default function Security() {
  return (
    <ModernPage
      title="Security & Compliance"
      description="How we protect your business data"
      backButton
      showLogo
    >
      <div className="space-y-5 max-w-3xl mx-auto pb-12">
        {/* Effective Date */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30 p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                Last Updated: {EFFECTIVE_DATE}
              </p>
              <p className="text-emerald-700 dark:text-emerald-400">
                {COMPANY_NAME} is committed to protecting your business data. This page describes the security measures, practices, and compliance standards we implement across the {SERVICE_NAME} platform.
              </p>
            </div>
          </div>
        </div>

        {/* 1. Encryption */}
        <Section
          icon={<Lock className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          iconBg="bg-teal-50 dark:bg-teal-950/50"
          title="1. Encryption"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li><strong>In transit:</strong> All data transmitted between your browser and our servers is encrypted using TLS 1.2+ (HTTPS). We enforce HSTS with a minimum max-age of one year.</li>
            <li><strong>At rest:</strong> Business data stored in our database is encrypted using AES-256. Sensitive fields (credentials, API keys) receive additional application-level encryption.</li>
            <li><strong>Payment data:</strong> Payment card information is handled exclusively by Stripe and never touches our servers. Stripe is PCI DSS Level 1 certified.</li>
          </ul>
        </Section>

        {/* 2. Authentication & Access Control */}
        <Section
          icon={<Key className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          title="2. Authentication &amp; Access Control"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li><strong>Secure authentication:</strong> Passwords are hashed with bcrypt (cost factor 12). Authentication sessions use signed JWT tokens with configurable expiry.</li>
            <li><strong>Role-based access control (RBAC):</strong> Users are assigned roles (owner, admin, manager, staff) with granular permissions. Every API call and database query enforces tenant isolation.</li>
            <li><strong>Row-level security (RLS):</strong> Database policies enforce tenant isolation at the database level, preventing cross-tenant data access even in the event of application bugs.</li>
            <li><strong>Rate limiting:</strong> Authentication endpoints are rate-limited to prevent brute-force attacks.</li>
            <li><strong>Session management:</strong> Sessions expire after inactivity. Compromised sessions can be revoked immediately.</li>
          </ul>
        </Section>

        {/* 3. Infrastructure */}
        <Section
          icon={<Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          title="3. Infrastructure &amp; Hosting"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li><strong>Cloud hosting:</strong> The Service is hosted on Vercel (frontend) and Supabase (backend/database), both of which maintain SOC 2 Type II certifications.</li>
            <li><strong>Geographic redundancy:</strong> Data is replicated across multiple availability zones for disaster recovery.</li>
            <li><strong>Automatic backups:</strong> Database backups are performed daily with point-in-time recovery capabilities.</li>
            <li><strong>DDoS protection:</strong> Cloudflare and Vercel edge network provide DDoS mitigation and traffic filtering.</li>
            <li><strong>Edge functions:</strong> Server-side logic runs on Supabase Edge Functions in isolated execution environments.</li>
          </ul>
        </Section>

        {/* 4. Application Security */}
        <Section
          icon={<Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-50 dark:bg-violet-950/50"
          title="4. Application Security"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li><strong>Input validation:</strong> All user input is validated server-side using Zod schemas before processing.</li>
            <li><strong>SQL injection prevention:</strong> All database queries use parameterized statements via Supabase client libraries.</li>
            <li><strong>XSS prevention:</strong> HTML output is sanitized with DOMPurify. Content Security Policy headers restrict script execution.</li>
            <li><strong>CSRF protection:</strong> Anti-CSRF tokens are required for state-changing operations.</li>
            <li><strong>Security headers:</strong> We set strict Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers on all responses.</li>
            <li><strong>Dependency management:</strong> Dependencies are regularly updated and monitored for known vulnerabilities.</li>
          </ul>
        </Section>

        {/* 5. Data Privacy */}
        <Section
          icon={<Eye className="h-5 w-5 text-sky-600 dark:text-sky-400" />}
          iconBg="bg-sky-50 dark:bg-sky-950/50"
          title="5. Data Privacy &amp; Tenant Isolation"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li><strong>Tenant isolation:</strong> Every database query is filtered by tenant_id. Row-level security policies enforce this at the database layer.</li>
            <li><strong>Data minimization:</strong> We collect only the data necessary to provide the Service.</li>
            <li><strong>Data portability:</strong> You can export your business data at any time through the Service.</li>
            <li><strong>Data deletion:</strong> Upon account termination, your data is deleted within 30 days (subject to legal retention requirements).</li>
            <li><strong>No data selling:</strong> We do not sell, rent, or trade your personal or business data to third parties.</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">
            See our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> for full details on how we handle personal data.
          </p>
        </Section>

        {/* 6. Compliance */}
        <Section
          icon={<CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          title="6. Compliance Standards"
        >
          <div className="space-y-3 text-sm">
            <p>We align our security practices with industry standards and regulatory requirements:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li><strong>SOC 2 aligned controls:</strong> Our security controls are aligned with SOC 2 Trust Services Criteria (security, availability, confidentiality). Our infrastructure providers (Vercel, Supabase) maintain SOC 2 Type II certifications.</li>
              <li><strong>GDPR compliance:</strong> We implement data subject rights (access, correction, deletion, portability), maintain data processing records, and use Standard Contractual Clauses for international transfers.</li>
              <li><strong>CCPA/CPRA compliance:</strong> California residents can exercise their rights to know, delete, correct, and opt out. See our Privacy Policy for details.</li>
              <li><strong>PCI DSS:</strong> We do not store, process, or transmit payment card data. All payment processing is handled by Stripe, which is PCI DSS Level 1 certified.</li>
            </ul>
          </div>
        </Section>

        {/* 7. Monitoring & Auditing */}
        <Section
          icon={<Server className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          title="7. Monitoring &amp; Audit Logging"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li><strong>Audit logs:</strong> Administrative actions (user creation, role changes, data exports, setting modifications) are logged with timestamps and actor identity.</li>
            <li><strong>Access logs:</strong> API access is logged for security monitoring and anomaly detection.</li>
            <li><strong>Error monitoring:</strong> Application errors are captured and triaged for security-relevant patterns.</li>
            <li><strong>Uptime monitoring:</strong> Service availability is continuously monitored with automated alerting.</li>
          </ul>
        </Section>

        {/* 8. Incident Response */}
        <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-950/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-amber-900 dark:text-amber-200">8. Security Incident Response</h3>
                <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 text-xs mt-1">IMPORTANT</Badge>
              </div>
            </div>
          </div>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm">In the event of a security incident affecting your data, we will:</p>
            <ul className="space-y-1.5 text-sm list-disc list-inside">
              <li>Immediately contain and investigate the incident.</li>
              <li>Notify affected users and relevant supervisory authorities within 72 hours as required by GDPR and applicable breach notification laws.</li>
              <li>Provide a clear description of the incident, the data affected, and remediation steps.</li>
              <li>Implement corrective measures to prevent recurrence.</li>
            </ul>
            <p className="text-sm">
              To report a suspected security vulnerability, contact us at {SECURITY_EMAIL}. We take all reports seriously and will investigate promptly.
            </p>
          </CardContent>
        </div>

        {/* Disclaimer */}
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 overflow-hidden">
          <div className="bg-red-50 dark:bg-red-950/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-red-900 dark:text-red-200">Disclaimer</h3>
                <Badge variant="outline" className="text-red-600 border-red-300 dark:text-red-400 dark:border-red-700 text-xs mt-1">IMPORTANT</Badge>
              </div>
            </div>
          </div>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm">
              WHILE WE IMPLEMENT COMMERCIALLY REASONABLE SECURITY MEASURES, NO METHOD OF ELECTRONIC TRANSMISSION OR STORAGE IS 100% SECURE. WE CANNOT GUARANTEE ABSOLUTE SECURITY OF YOUR DATA. YOU ACKNOWLEDGE AND ACCEPT THE INHERENT RISKS OF TRANSMITTING AND STORING DATA ELECTRONICALLY.
            </p>
            <p className="text-sm">
              THE SECURITY MEASURES DESCRIBED ON THIS PAGE REFLECT OUR CURRENT PRACTICES AND MAY BE UPDATED FROM TIME TO TIME. THIS PAGE IS FOR INFORMATIONAL PURPOSES ONLY AND DOES NOT CONSTITUTE A WARRANTY, GUARANTEE, OR CONTRACTUAL COMMITMENT.
            </p>
          </CardContent>
        </div>

        {/* Contact */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-semibold text-lg">Contact Us</h3>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>For security questions, vulnerability reports, or compliance inquiries:</p>
              <p className="font-medium text-foreground">{COMPANY_NAME}</p>
              <p>Security: {SECURITY_EMAIL}</p>
            </div>
          </CardContent>
        </Card>
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
