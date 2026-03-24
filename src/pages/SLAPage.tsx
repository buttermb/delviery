import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Clock,
  Activity,
  Zap,
  AlertTriangle,
  Wrench,
  Mail,
  BarChart3,
  Server,
} from 'lucide-react';

const EFFECTIVE_DATE = 'March 20, 2026';
const COMPANY_NAME = 'FloraIQ Inc.';
const SERVICE_NAME = 'FloraIQ';
const SUPPORT_EMAIL = 'support@floraiq.com';

export default function SLAPage() {
  return (
    <ModernPage
      title="Service Level Agreement"
      description="Uptime commitments, performance targets, and support response times"
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
                This Service Level Agreement (&quot;SLA&quot;) is part of the Terms of Service between {COMPANY_NAME} and you (&quot;Customer&quot;) for the provision of {SERVICE_NAME}. This SLA defines our commitments regarding service availability, performance, and support response times.
              </p>
            </div>
          </div>
        </div>

        {/* 1. Service Availability */}
        <Section
          icon={<Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          title="1. Service Availability"
        >
          <div className="space-y-3 text-sm">
            <p>{COMPANY_NAME} commits to the following monthly uptime targets:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-semibold">Plan</th>
                    <th className="py-2 pr-4 font-semibold">Uptime Target</th>
                    <th className="py-2 font-semibold">Max Downtime / Month</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4">Starter</td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline" className="text-xs">99.5%</Badge>
                    </td>
                    <td className="py-2">~3.6 hours</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Professional</td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800">99.9%</Badge>
                    </td>
                    <td className="py-2">~43 minutes</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Enterprise</td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800">99.95%</Badge>
                    </td>
                    <td className="py-2">~22 minutes</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground">
              Uptime is calculated as: (Total minutes in month &minus; Downtime minutes) / Total minutes in month &times; 100. Uptime is measured at the application layer, excluding scheduled maintenance windows.
            </p>
          </div>
        </Section>

        {/* 2. Exclusions */}
        <Section
          icon={<AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          title="2. SLA Exclusions"
        >
          <div className="space-y-3 text-sm">
            <p>The following events are excluded from uptime calculations:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Scheduled maintenance:</strong> Pre-announced maintenance windows (minimum 48 hours notice, performed during off-peak hours when possible).</li>
              <li><strong>Force majeure:</strong> Events beyond our reasonable control, including natural disasters, government actions, pandemics, or Internet backbone failures.</li>
              <li><strong>Third-party failures:</strong> Outages caused by third-party services (Stripe, Mapbox, etc.) that are outside our direct control.</li>
              <li><strong>Customer-caused issues:</strong> Downtime resulting from Customer&apos;s misuse, unauthorized modifications, or actions violating the Terms of Service or AUP.</li>
              <li><strong>DDoS attacks:</strong> Downtime caused by distributed denial-of-service attacks, though we will exercise commercially reasonable efforts to mitigate such attacks.</li>
              <li><strong>Beta features:</strong> Features explicitly marked as &quot;Beta&quot; or &quot;Preview&quot; are not covered by this SLA.</li>
            </ul>
          </div>
        </Section>

        {/* 3. Performance Targets */}
        <Section
          icon={<Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-50 dark:bg-violet-950/50"
          title="3. Performance Targets"
        >
          <div className="space-y-3 text-sm">
            <p>We target the following performance benchmarks under normal operating conditions:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-semibold">Metric</th>
                    <th className="py-2 pr-4 font-semibold">Target (p95)</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-2 pr-4">Page load time (initial)</td><td className="py-2">&lt; 3 seconds</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">API response time</td><td className="py-2">&lt; 500ms</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">Real-time event delivery</td><td className="py-2">&lt; 2 seconds</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">Search query response</td><td className="py-2">&lt; 1 second</td></tr>
                  <tr><td className="py-2 pr-4">File upload processing</td><td className="py-2">&lt; 10 seconds (per 10MB)</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground">
              Performance targets are measured at the 95th percentile (p95) and are goals, not guarantees. Actual performance may vary based on network conditions, data volume, and geographic location.
            </p>
          </div>
        </Section>

        {/* 4. Support Response Times */}
        <Section
          icon={<Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          title="4. Support Response Times"
        >
          <div className="space-y-3 text-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-semibold">Severity</th>
                    <th className="py-2 pr-4 font-semibold">Definition</th>
                    <th className="py-2 pr-4 font-semibold">First Response</th>
                    <th className="py-2 font-semibold">Resolution Target</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge variant="destructive" className="text-xs">Critical</Badge></td>
                    <td className="py-2 pr-4">Service is completely unavailable or data loss is occurring</td>
                    <td className="py-2 pr-4">1 hour</td>
                    <td className="py-2">4 hours</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge variant="default" className="text-xs bg-orange-500">High</Badge></td>
                    <td className="py-2 pr-4">Major feature is unusable; no workaround available</td>
                    <td className="py-2 pr-4">4 hours</td>
                    <td className="py-2">1 business day</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><Badge variant="outline" className="text-xs">Medium</Badge></td>
                    <td className="py-2 pr-4">Feature is degraded; workaround is available</td>
                    <td className="py-2 pr-4">1 business day</td>
                    <td className="py-2">5 business days</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><Badge variant="secondary" className="text-xs">Low</Badge></td>
                    <td className="py-2 pr-4">Minor issue, cosmetic bug, or feature request</td>
                    <td className="py-2 pr-4">2 business days</td>
                    <td className="py-2">Best effort</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground">
              Business hours are Monday&ndash;Friday, 9:00 AM&ndash;6:00 PM Eastern Time, excluding US federal holidays. Critical severity issues receive 24/7 support for Professional and Enterprise plans.
            </p>
          </div>
        </Section>

        {/* 5. Service Credits */}
        <Section
          icon={<BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          iconBg="bg-teal-50 dark:bg-teal-950/50"
          title="5. Service Credits"
        >
          <div className="space-y-3 text-sm">
            <p>If we fail to meet the uptime commitment for your plan tier in a given calendar month, you may request a service credit:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 font-semibold">Monthly Uptime</th>
                    <th className="py-2 font-semibold">Credit (% of Monthly Fee)</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-2 pr-4">Below target but &ge; 99.0%</td><td className="py-2">10%</td></tr>
                  <tr className="border-b"><td className="py-2 pr-4">98.0% &ndash; 98.99%</td><td className="py-2">25%</td></tr>
                  <tr><td className="py-2 pr-4">Below 98.0%</td><td className="py-2">50%</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground">
              Service credits must be requested within 30 days of the end of the affected month. Credits are applied to future invoices and do not exceed 50% of the monthly fee. Credits are the sole and exclusive remedy for any failure to meet the SLA.
            </p>
          </div>
        </Section>

        {/* 6. Scheduled Maintenance */}
        <Section
          icon={<Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-50 dark:bg-orange-950/50"
          title="6. Scheduled Maintenance"
        >
          <div className="space-y-3 text-sm">
            <p>We perform scheduled maintenance to keep the Service secure and reliable:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Notification:</strong> At least 48 hours advance notice via email and in-app banner.</li>
              <li><strong>Timing:</strong> Maintenance windows are scheduled during off-peak hours (typically 2:00&ndash;6:00 AM Eastern Time, Sunday).</li>
              <li><strong>Duration:</strong> Planned maintenance windows typically last under 30 minutes.</li>
              <li><strong>Emergency maintenance:</strong> In the event of a critical security patch or urgent fix, we may perform emergency maintenance with shorter notice. We will provide as much advance notice as reasonably possible.</li>
            </ul>
          </div>
        </Section>

        {/* 7. Monitoring & Status */}
        <Section
          icon={<Server className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          title="7. Monitoring &amp; Incident Communication"
        >
          <div className="space-y-3 text-sm">
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Status page:</strong> Real-time service status is available at our <a href="/status" className="underline hover:text-foreground transition-colors">Status Page</a>.</li>
              <li><strong>Incident updates:</strong> During outages, we provide updates every 30 minutes until resolution or every hour for lower-severity incidents.</li>
              <li><strong>Post-incident reports:</strong> For Critical-severity incidents, we publish a root cause analysis (RCA) within 5 business days of resolution.</li>
              <li><strong>Uptime reporting:</strong> Monthly uptime reports are available upon request for Professional and Enterprise customers.</li>
            </ul>
          </div>
        </Section>

        {/* 8. Limitations */}
        <Section
          icon={<AlertTriangle className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
          iconBg="bg-gray-100 dark:bg-gray-800"
          title="8. Limitations"
        >
          <div className="space-y-3 text-sm">
            <p>This SLA does not apply to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Free trial accounts or accounts with overdue payments.</li>
              <li>Features explicitly designated as &quot;Alpha&quot;, &quot;Beta&quot;, or &quot;Preview&quot;.</li>
              <li>Third-party integrations or services accessed through {SERVICE_NAME}.</li>
              <li>Custom development or professional services engagements (covered by separate agreements).</li>
            </ul>
            <p className="text-muted-foreground">
              Service credits under this SLA constitute the Customer&apos;s sole and exclusive remedy for any failure by {COMPANY_NAME} to meet the service levels described herein. This SLA does not modify or supersede the limitation of liability provisions in the Terms of Service.
            </p>
          </div>
        </Section>

        {/* Contact */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center">
                <Mail className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="font-semibold text-lg">Support</h3>
            </div>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>For SLA-related inquiries, service credit requests, or to report an incident:</p>
              <p className="font-medium text-foreground">{COMPANY_NAME}</p>
              <p>Email: {SUPPORT_EMAIL}</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground px-4">
          This SLA is subject to the Terms of Service. In the event of a conflict, the Terms of Service shall prevail except where this SLA provides more specific commitments regarding service levels.
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
