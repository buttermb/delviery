import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Cookie as CookieIcon,
  Shield,
  Clock,
  Globe,
  Settings,
  BarChart3,
  AlertTriangle,
  Mail,
} from 'lucide-react';

const EFFECTIVE_DATE = 'March 20, 2026';
const COMPANY_NAME = 'FloraIQ Inc.';
const SERVICE_NAME = 'FloraIQ';
const PRIVACY_EMAIL = 'privacy@floraiq.com';

export default function Cookie() {
  return (
    <ModernPage
      title="Cookie Policy"
      description="How we use cookies and similar technologies"
      backButton
      showLogo
    >
      <div className="space-y-5 max-w-3xl mx-auto pb-12">
        {/* Effective Date */}
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/30 p-4">
          <div className="flex items-start gap-3">
            <CookieIcon className="h-5 w-5 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-sky-800 dark:text-sky-300">
                Effective Date: {EFFECTIVE_DATE}
              </p>
              <p className="text-sky-700 dark:text-sky-400">
                This Cookie Policy explains how {COMPANY_NAME} (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) uses cookies and similar tracking technologies when you use {SERVICE_NAME}. This policy should be read alongside our Privacy Policy, which explains how we process personal data.
              </p>
            </div>
          </div>
        </div>

        {/* 1. What Are Cookies */}
        <Section
          icon={<CookieIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          title="1. What Are Cookies"
        >
          <div className="space-y-3 text-sm">
            <p>
              Cookies are small text files placed on your device (computer, tablet, or mobile phone) when you visit a website. They are widely used to make websites function, work more efficiently, and provide reporting information to site operators.
            </p>
            <p>
              <strong>Session cookies</strong> are temporary and deleted when you close your browser. <strong>Persistent cookies</strong> remain on your device for a set period or until you manually delete them.
            </p>
            <p>
              We also use similar technologies such as local storage, session storage, and pixel tags, which function similarly to cookies. References to &quot;cookies&quot; in this policy include these technologies.
            </p>
          </div>
        </Section>

        {/* 2. Cookies We Use */}
        <Section
          icon={<Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          title="2. Strictly Necessary Cookies"
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="default" className="text-xs">Required</Badge>
              <span className="text-muted-foreground">Cannot be disabled</span>
            </div>
            <p>These cookies are essential for the Service to function. Without them, the Service cannot operate correctly. They include:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Authentication cookies</strong> &mdash; maintain your login session and identify your account (Supabase auth tokens)</li>
              <li><strong>CSRF tokens</strong> &mdash; protect against cross-site request forgery attacks</li>
              <li><strong>Tenant session cookies</strong> &mdash; identify your business workspace</li>
              <li><strong>Security cookies</strong> &mdash; Cloudflare Turnstile anti-bot verification</li>
              <li><strong>Cookie consent preferences</strong> &mdash; store your cookie choices</li>
            </ul>
            <p className="text-muted-foreground">Retention: session or up to 30 days depending on the cookie.</p>
          </div>
        </Section>

        <Section
          icon={<BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          title="3. Analytics &amp; Performance Cookies"
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">Optional</Badge>
              <span className="text-muted-foreground">Can be disabled</span>
            </div>
            <p>These cookies help us understand how visitors use the Service so we can measure and improve performance:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Vercel Analytics</strong> &mdash; privacy-focused web analytics (page views, performance metrics). No personal data is collected.</li>
              <li><strong>Vercel Speed Insights</strong> &mdash; real user performance monitoring (Core Web Vitals).</li>
              <li><strong>Error tracking</strong> &mdash; captures error reports to help us fix bugs (no personal data included).</li>
            </ul>
            <p className="text-muted-foreground">Retention: up to 12 months.</p>
          </div>
        </Section>

        <Section
          icon={<Settings className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-50 dark:bg-violet-950/50"
          title="4. Functional Cookies"
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">Optional</Badge>
              <span className="text-muted-foreground">Can be disabled</span>
            </div>
            <p>These cookies enable enhanced functionality and personalization:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Theme preference</strong> &mdash; remembers your light/dark mode choice (local storage)</li>
              <li><strong>Sidebar state</strong> &mdash; remembers collapsed/expanded sidebar (local storage)</li>
              <li><strong>Dashboard layout</strong> &mdash; stores your widget arrangement preferences</li>
              <li><strong>PWA install state</strong> &mdash; tracks whether you&apos;ve dismissed the install prompt</li>
            </ul>
            <p className="text-muted-foreground">Retention: persistent until cleared by you.</p>
          </div>
        </Section>

        {/* 5. Third-Party Cookies */}
        <Section
          icon={<Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          iconBg="bg-cyan-50 dark:bg-cyan-950/50"
          title="5. Third-Party Cookies"
        >
          <div className="space-y-3 text-sm">
            <p>Certain third-party services integrated into {SERVICE_NAME} may set their own cookies:</p>
            <ul className="space-y-2">
              <li><strong>Stripe</strong> &mdash; payment processing and fraud prevention. Stripe sets cookies for secure payment sessions and fraud detection. See <span className="text-muted-foreground">Stripe&apos;s Cookie Policy</span> for details.</li>
              <li><strong>Cloudflare</strong> &mdash; security and performance. Cloudflare sets cookies for bot detection and DDoS protection.</li>
              <li><strong>Mapbox</strong> &mdash; map rendering for delivery and route planning features. May set cookies for usage analytics.</li>
            </ul>
            <p className="text-muted-foreground">
              We do not control third-party cookies. Each provider is governed by their own privacy and cookie policies.
            </p>
          </div>
        </Section>

        {/* 6. Legal Basis (GDPR) */}
        <Section
          icon={<Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          title="6. Legal Basis for Cookies (GDPR)"
        >
          <div className="space-y-3 text-sm">
            <p>Under the General Data Protection Regulation (GDPR) and ePrivacy Directive:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Strictly necessary cookies</strong> are placed under the &quot;legitimate interest&quot; basis, as they are essential for the Service to function.</li>
              <li><strong>Analytics, functional, and third-party cookies</strong> are placed only with your <strong>prior consent</strong>, which you provide through our cookie consent banner.</li>
            </ul>
            <p>You may withdraw consent at any time (see Section 7 below). Withdrawal of consent does not affect the lawfulness of processing based on consent given before withdrawal.</p>
          </div>
        </Section>

        {/* 7. Managing Cookies */}
        <Section
          icon={<Settings className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          iconBg="bg-teal-50 dark:bg-teal-950/50"
          title="7. How to Manage Cookies"
        >
          <div className="space-y-3 text-sm">
            <p>You have several options for managing cookies:</p>
            <ul className="space-y-2">
              <li><strong>Cookie consent banner:</strong> When you first visit the Service, you can accept or reject optional cookies. You can change your preferences at any time through your account settings.</li>
              <li><strong>Browser settings:</strong> Most browsers allow you to block or delete cookies through their settings. Consult your browser&apos;s help documentation for instructions.</li>
              <li><strong>Device settings:</strong> On mobile devices, you can manage cookie and tracking preferences through your operating system settings.</li>
            </ul>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mt-3">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Note:</strong> Disabling strictly necessary cookies will impair core functionality. You may not be able to log in, maintain sessions, or use essential features.
              </p>
            </div>
          </div>
        </Section>

        {/* 8. Do Not Track */}
        <Section
          icon={<Clock className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          title="8. Do Not Track Signals"
        >
          <p className="text-sm">
            We currently do not respond to &quot;Do Not Track&quot; (DNT) browser signals, as there is no universally accepted industry standard for compliance. However, you can manage tracking through the cookie controls described in Section 7 above.
          </p>
        </Section>

        {/* 9. Cookie Retention */}
        <Section
          icon={<Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-50 dark:bg-orange-950/50"
          title="9. Cookie Retention Periods"
        >
          <div className="text-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-semibold">Category</th>
                    <th className="py-2 pr-4 font-semibold">Retention</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-2 pr-4">Authentication</td><td className="py-2">Session &ndash; 30 days</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">Security (CSRF, Turnstile)</td><td className="py-2">Session</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">Analytics</td><td className="py-2">Up to 12 months</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">Functional (preferences)</td><td className="py-2">Persistent until cleared</td></tr>
                  <tr><td className="py-2 pr-4">Consent preferences</td><td className="py-2">12 months</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* 10. Changes */}
        <Section
          icon={<AlertTriangle className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
          iconBg="bg-gray-100 dark:bg-gray-800"
          title="10. Changes to This Cookie Policy"
        >
          <p className="text-sm">
            We may update this Cookie Policy from time to time to reflect changes in the cookies we use, our technology, legal requirements, or other factors. We will post the revised policy with an updated effective date. Material changes will be communicated via email or in-app notification. Your continued use of the Service after the updated policy becomes effective constitutes your acceptance.
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
              <p>For questions about our use of cookies or this policy:</p>
              <p className="font-medium text-foreground">{COMPANY_NAME}</p>
              <p>Email: {PRIVACY_EMAIL}</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground px-4">
          By using {SERVICE_NAME}, you acknowledge that you have read and understood this Cookie Policy.
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
