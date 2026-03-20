import { ModernPage } from '@/templates/ModernPageTemplate';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Scale,
  Ban,
  CreditCard,
  Shield,
  Gavel,
  AlertTriangle,
  UserX,
  Clock,
  BookOpen,
  Globe,
  Coins,
  Zap,
  Server,
} from 'lucide-react';

const EFFECTIVE_DATE = 'March 20, 2026';
const COMPANY_NAME = 'FloraIQ Inc.';
const SERVICE_NAME = 'FloraIQ';
const SUPPORT_EMAIL = 'legal@floraiq.com';
const JURISDICTION = 'New York, New York';

export default function TermsPage() {
  return (
    <ModernPage
      title="Terms of Service"
      description="Please read these terms carefully before using FloraIQ"
      backButton
      showLogo
    >
      <div className="space-y-5 max-w-3xl mx-auto pb-12">
        {/* Effective Date & Notice */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Effective Date: {EFFECTIVE_DATE}
              </p>
              <p className="text-amber-700 dark:text-amber-400">
                By creating an account, accessing, or using {SERVICE_NAME} in any way, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, you must not use the Service.
              </p>
            </div>
          </div>
        </div>

        {/* 1. Definitions */}
        <Section
          icon={<BookOpen className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          title="1. Definitions"
        >
          <ul className="space-y-2 text-sm">
            <li><strong>&quot;Service&quot;</strong> means the {SERVICE_NAME} platform, including all websites, applications, APIs, edge functions, and related services operated by {COMPANY_NAME}.</li>
            <li><strong>&quot;User,&quot; &quot;You,&quot; &quot;Your&quot;</strong> means any individual or entity that accesses or uses the Service.</li>
            <li><strong>&quot;We,&quot; &quot;Us,&quot; &quot;Our&quot;</strong> means {COMPANY_NAME}, its affiliates, officers, directors, employees, and agents.</li>
            <li><strong>&quot;Content&quot;</strong> means any data, text, images, files, or materials uploaded, submitted, or generated through the Service.</li>
            <li><strong>&quot;Credits&quot;</strong> means the virtual unit of account used within the Service to access features and functionality.</li>
            <li><strong>&quot;Tenant&quot;</strong> means a business entity with an active account on the Service.</li>
          </ul>
        </Section>

        {/* 2. Eligibility */}
        <Section
          icon={<Scale className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          title="2. Eligibility &amp; Account Requirements"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li>You must be at least 21 years of age and legally capable of entering into binding contracts.</li>
            <li>You must hold all licenses, permits, and authorizations required by applicable law to operate your business and use the Service.</li>
            <li>You must provide accurate, current, and complete registration information and maintain its accuracy.</li>
            <li>You are solely responsible for all activity under your account, including maintaining the confidentiality of your credentials.</li>
            <li>One account per business entity unless explicitly authorized in writing.</li>
            <li>You must notify us immediately of any unauthorized access or security breach.</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">
            We reserve the right to refuse service, terminate accounts, or restrict access at our sole discretion, with or without cause, and with or without notice.
          </p>
        </Section>

        {/* 3. Acceptable Use */}
        <Section
          icon={<FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          title="3. Acceptable Use"
        >
          <p className="text-sm mb-3">You agree to use the Service only for lawful purposes and in accordance with these Terms. You may:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Use the Service for legitimate wholesale business operations in compliance with all applicable laws</li>
            <li>Create and manage orders, inventory, customers, and financial records</li>
            <li>Access and export your own business data</li>
            <li>Integrate with approved third-party services through our documented APIs</li>
          </ul>
        </Section>

        {/* 4. Prohibited Activities */}
        <Section
          icon={<Ban className="h-5 w-5 text-red-600 dark:text-red-400" />}
          iconBg="bg-red-50 dark:bg-red-950/50"
          title="4. Prohibited Activities"
        >
          <p className="text-sm mb-3">You shall NOT, directly or indirectly:</p>
          <ul className="space-y-1.5 text-sm list-disc list-inside">
            <li>Violate any applicable local, state, national, or international law or regulation</li>
            <li>Conduct business with unlicensed entities or individuals under the legal age</li>
            <li>Attempt to gain unauthorized access to any part of the Service, other accounts, or connected systems</li>
            <li>Use the Service for fraudulent, deceptive, or misleading activities</li>
            <li>Scrape, crawl, harvest, or collect data from the platform by automated means</li>
            <li>Reverse-engineer, decompile, disassemble, or attempt to derive the source code of the Service</li>
            <li>Resell, redistribute, sublicense, or provide access to the Service to unauthorized third parties</li>
            <li>Upload malware, viruses, trojans, or any harmful or malicious code</li>
            <li>Impersonate another user, business, or entity</li>
            <li>Interfere with or disrupt the integrity, security, or performance of the Service</li>
            <li>Circumvent any usage limits, credit restrictions, rate limits, or security measures</li>
            <li>Use the Service in any manner that could damage, disable, overburden, or impair it</li>
          </ul>
        </Section>

        {/* 5. Credit System */}
        <Section
          icon={<Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          title="5. Credit System"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li>Credits are a virtual unit of account with no monetary value outside the Service.</li>
            <li>Credits are non-transferable, non-refundable, and cannot be exchanged for cash.</li>
            <li>Free credits are granted at our sole discretion and may be modified, reduced, or discontinued at any time without notice.</li>
            <li>Unused credits may expire as described in the applicable plan terms.</li>
            <li>We reserve the right to adjust credit balances to correct errors or prevent abuse.</li>
            <li>Purchased credits are subject to the refund terms in Section 6.</li>
            <li>We are not liable for any loss, damage, or inconvenience arising from credit balance changes, expirations, or system adjustments.</li>
          </ul>
        </Section>

        {/* 6. Payment & Billing */}
        <Section
          icon={<CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          title="6. Payment, Billing &amp; Refunds"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li>Subscription fees are billed in advance on a monthly or annual basis, depending on your selected plan.</li>
            <li>All fees are non-refundable except where required by applicable law.</li>
            <li>Prices may change at any time with 30 days&apos; prior notice. Continued use after a price change constitutes acceptance.</li>
            <li>Failed payments may result in immediate suspension or termination of access.</li>
            <li>You are solely responsible for all applicable taxes, duties, and governmental charges.</li>
            <li>Payment information must be kept current. We are not responsible for service interruptions due to expired or declined payment methods.</li>
            <li>Trial periods, if offered, may be modified or discontinued at any time. We may charge the applicable fee upon trial expiration unless you cancel before the trial ends.</li>
            <li>Chargebacks or payment disputes initiated without first contacting us may result in immediate account termination.</li>
          </ul>
        </Section>

        {/* 7. Cancellation & Termination */}
        <Section
          icon={<UserX className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-50 dark:bg-orange-950/50"
          title="7. Cancellation &amp; Termination"
        >
          <div className="space-y-3 text-sm">
            <p><strong>By You:</strong> You may cancel your subscription at any time through your account settings. Access continues until the end of the current billing period. No partial refunds are issued.</p>
            <p><strong>By Us:</strong> We may suspend, restrict, or terminate your account at any time, with or without notice, for any reason including but not limited to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Violation of these Terms or any applicable law</li>
              <li>Fraudulent, abusive, or illegal activity</li>
              <li>Non-payment or payment disputes</li>
              <li>Inactivity for 6 or more consecutive months</li>
              <li>Requests from law enforcement or government agencies</li>
              <li>Discontinuation of the Service (in whole or part)</li>
            </ul>
            <p><strong>Effect of Termination:</strong> Upon termination, your right to use the Service ceases immediately. We may delete your data after 30 days. We are not liable for any loss of data, content, or access resulting from termination.</p>
            <p><strong>Survival:</strong> Sections 8 through 16 survive termination of these Terms.</p>
          </div>
        </Section>

        {/* 8. Intellectual Property */}
        <Section
          icon={<Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-50 dark:bg-violet-950/50"
          title="8. Intellectual Property"
        >
          <div className="space-y-3 text-sm">
            <p>
              The Service, including all software, source code, algorithms, designs, interfaces, logos, trademarks, trade secrets, and documentation, is the exclusive property of {COMPANY_NAME} and is protected by copyright, trademark, trade secret, and other intellectual property laws.
            </p>
            <p>
              You receive a limited, non-exclusive, non-transferable, revocable license to access and use the Service solely for your internal business purposes, subject to these Terms. This license does not convey any ownership rights.
            </p>
            <p>
              <strong>Your Content:</strong> You retain ownership of data you upload. By uploading Content, you grant us a worldwide, royalty-free license to use, process, store, and display that Content solely to provide the Service. You represent that you have all necessary rights to grant this license.
            </p>
          </div>
        </Section>

        {/* 9. Disclaimer of Warranties */}
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 overflow-hidden">
          <div className="bg-red-50 dark:bg-red-950/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-red-900 dark:text-red-200">9. Disclaimer of Warranties</h3>
                <Badge variant="outline" className="text-red-600 border-red-300 dark:text-red-400 dark:border-red-700 text-xs mt-1">IMPORTANT &mdash; READ CAREFULLY</Badge>
              </div>
            </div>
          </div>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-semibold uppercase">
              THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-sm">
              WE DO NOT WARRANT THAT: (A) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; (B) THE RESULTS OBTAINED FROM THE SERVICE WILL BE ACCURATE, RELIABLE, OR COMPLETE; (C) THE SERVICE WILL MEET YOUR REQUIREMENTS OR EXPECTATIONS; (D) ANY ERRORS OR DEFECTS WILL BE CORRECTED; OR (E) THE SERVICE IS FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
            <p className="text-sm">
              YOU ACKNOWLEDGE THAT YOU USE THE SERVICE ENTIRELY AT YOUR OWN RISK. WE ARE NOT RESPONSIBLE FOR ANY DECISIONS MADE OR ACTIONS TAKEN BASED ON INFORMATION PROVIDED THROUGH THE SERVICE, INCLUDING BUT NOT LIMITED TO INVENTORY MANAGEMENT, PRICING, ORDER FULFILLMENT, FINANCIAL REPORTING, OR REGULATORY COMPLIANCE DECISIONS.
            </p>
            <p className="text-sm">
              WE MAKE NO REPRESENTATIONS REGARDING THE ACCURACY, COMPLETENESS, OR TIMELINESS OF ANY DATA, CALCULATIONS, OR ANALYTICS PROVIDED BY THE SERVICE. YOU ARE SOLELY RESPONSIBLE FOR INDEPENDENTLY VERIFYING ALL INFORMATION BEFORE RELYING ON IT.
            </p>
          </CardContent>
        </div>

        {/* 10. Limitation of Liability */}
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 overflow-hidden">
          <div className="bg-red-50 dark:bg-red-950/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <Gavel className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-red-900 dark:text-red-200">10. Limitation of Liability</h3>
                <Badge variant="outline" className="text-red-600 border-red-300 dark:text-red-400 dark:border-red-700 text-xs mt-1">IMPORTANT &mdash; READ CAREFULLY</Badge>
              </div>
            </div>
          </div>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-semibold uppercase">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL {COMPANY_NAME.toUpperCase()}, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO: LOSS OF PROFITS, REVENUE, GOODWILL, DATA, BUSINESS OPPORTUNITIES, OR ANTICIPATED SAVINGS; BUSINESS INTERRUPTION; COST OF PROCUREMENT OF SUBSTITUTE SERVICES; OR ANY OTHER INTANGIBLE LOSSES, REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT, TORT, STRICT LIABILITY, OR OTHERWISE), EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="text-sm font-semibold uppercase">
              OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE LESSER OF: (A) THE TOTAL AMOUNT YOU PAID US IN THE SIX (6) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100.00 USD).
            </p>
            <p className="text-sm">
              THE FOREGOING LIMITATIONS APPLY EVEN IF A REMEDY FAILS ITS ESSENTIAL PURPOSE. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES, SO SOME OF THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU. IN SUCH CASES, OUR LIABILITY SHALL BE LIMITED TO THE FULLEST EXTENT PERMITTED BY LAW.
            </p>
          </CardContent>
        </div>

        {/* 11. Indemnification */}
        <Section
          icon={<Shield className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
          iconBg="bg-rose-50 dark:bg-rose-950/50"
          title="11. Indemnification"
        >
          <p className="text-sm">
            You agree to indemnify, defend, and hold harmless {COMPANY_NAME}, its affiliates, officers, directors, employees, agents, suppliers, and licensors from and against all claims, demands, actions, liabilities, damages, losses, costs, and expenses (including reasonable attorneys&apos; fees and court costs) arising out of or relating to: (a) your use of or access to the Service; (b) your violation of these Terms; (c) your violation of any applicable law or regulation; (d) your Content or data; (e) your interaction with any third party through the Service; or (f) your negligence or willful misconduct. This indemnification obligation survives termination of these Terms and your use of the Service.
          </p>
        </Section>

        {/* 12. Dispute Resolution & Arbitration */}
        <Section
          icon={<Gavel className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          title="12. Dispute Resolution &amp; Arbitration"
        >
          <div className="space-y-3 text-sm">
            <p className="font-semibold uppercase">
              PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT AND TO HAVE A JURY TRIAL.
            </p>
            <p>
              <strong>Informal Resolution:</strong> Before initiating any formal dispute proceedings, you agree to first contact us at {SUPPORT_EMAIL} and attempt to resolve the dispute informally for at least 30 days.
            </p>
            <p>
              <strong>Binding Arbitration:</strong> If informal resolution fails, any dispute, controversy, or claim arising out of or relating to these Terms or the Service shall be resolved by binding arbitration administered by the American Arbitration Association (&quot;AAA&quot;) under its Commercial Arbitration Rules. The arbitration shall take place in {JURISDICTION}. The arbitrator&apos;s decision shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.
            </p>
            <p className="font-semibold uppercase">
              CLASS ACTION WAIVER: YOU AND {COMPANY_NAME.toUpperCase()} AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. THE ARBITRATOR MAY NOT CONSOLIDATE MORE THAN ONE PERSON&apos;S CLAIMS AND MAY NOT PRESIDE OVER ANY FORM OF CLASS OR REPRESENTATIVE PROCEEDING.
            </p>
            <p className="font-semibold uppercase">
              JURY TRIAL WAIVER: YOU AND {COMPANY_NAME.toUpperCase()} WAIVE ANY RIGHT TO A JURY TRIAL FOR ANY DISPUTE ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE.
            </p>
          </div>
        </Section>

        {/* 13. Third-Party Services */}
        <Section
          icon={<Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          iconBg="bg-cyan-50 dark:bg-cyan-950/50"
          title="13. Third-Party Services &amp; Integrations"
        >
          <p className="text-sm">
            The Service may integrate with, link to, or rely upon third-party services (including payment processors, SMS providers, analytics platforms, and cloud infrastructure). We are not responsible for the availability, accuracy, content, policies, or practices of any third-party service. Your use of third-party services is governed by their respective terms and policies. We disclaim all liability for any loss or damage arising from your reliance on or use of third-party services, including but not limited to payment processing failures, data breaches at third-party providers, or service outages beyond our control.
          </p>
        </Section>

        {/* 14. Service Availability & Modifications */}
        <Section
          icon={<Server className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          iconBg="bg-teal-50 dark:bg-teal-950/50"
          title="14. Service Availability &amp; Modifications"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li>We may modify, suspend, or discontinue the Service (or any part thereof) at any time, with or without notice, and without liability to you.</li>
            <li>We do not guarantee any specific uptime, availability, or performance level unless expressly stated in a separate written service level agreement.</li>
            <li>Scheduled and unscheduled maintenance may result in temporary service disruptions.</li>
            <li>Features described as &quot;beta,&quot; &quot;experimental,&quot; or &quot;preview&quot; are provided without any warranty and may be removed at any time.</li>
            <li>We are not liable for any damages arising from modifications, suspensions, or discontinuation of the Service.</li>
          </ul>
        </Section>

        {/* 15. Force Majeure */}
        <Section
          icon={<Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />}
          iconBg="bg-yellow-50 dark:bg-yellow-950/50"
          title="15. Force Majeure"
        >
          <p className="text-sm">
            We shall not be liable for any failure or delay in performing our obligations where such failure or delay results from circumstances beyond our reasonable control, including but not limited to: acts of God, natural disasters, pandemics, epidemics, war, terrorism, riots, civil unrest, government actions, sanctions, embargoes, labor disputes, strikes, fire, flood, earthquake, power outages, internet service disruptions, cyberattacks, telecommunications failures, or failures of third-party service providers.
          </p>
        </Section>

        {/* 16. Governing Law & General Provisions */}
        <Section
          icon={<Scale className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          title="16. Governing Law &amp; General Provisions"
        >
          <div className="space-y-3 text-sm">
            <p><strong>Governing Law:</strong> These Terms are governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of law provisions.</p>
            <p><strong>Severability:</strong> If any provision of these Terms is held to be invalid or unenforceable, such provision shall be modified to the minimum extent necessary to make it valid and enforceable, and the remaining provisions shall remain in full force and effect.</p>
            <p><strong>Entire Agreement:</strong> These Terms, together with the Privacy Policy and any other agreements expressly incorporated by reference, constitute the entire agreement between you and {COMPANY_NAME} regarding the Service and supersede all prior agreements, understandings, and communications.</p>
            <p><strong>Waiver:</strong> Our failure to enforce any provision of these Terms shall not constitute a waiver of that provision or any other provision. A waiver of any provision is effective only if in writing and signed by {COMPANY_NAME}.</p>
            <p><strong>Assignment:</strong> You may not assign or transfer these Terms or your rights hereunder without our prior written consent. We may assign these Terms without restriction.</p>
            <p><strong>Notices:</strong> We may provide notices to you via email, in-app notification, or by posting on the Service. Notices to us must be sent to {SUPPORT_EMAIL}.</p>
            <p><strong>Modifications:</strong> We reserve the right to modify these Terms at any time. Material changes will be communicated with at least 15 days&apos; notice. Your continued use of the Service after such notice constitutes acceptance of the modified Terms. If you do not agree, you must stop using the Service.</p>
          </div>
        </Section>

        {/* 17. Regulatory Compliance Disclaimer */}
        <Section
          icon={<AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          title="17. Regulatory &amp; Compliance Disclaimer"
        >
          <div className="space-y-3 text-sm">
            <p>
              {SERVICE_NAME} is a software tool designed to assist with business operations. THE SERVICE DOES NOT PROVIDE LEGAL, REGULATORY, TAX, OR COMPLIANCE ADVICE. You are solely responsible for ensuring that your use of the Service and your business operations comply with all applicable federal, state, and local laws, regulations, ordinances, and licensing requirements.
            </p>
            <p>
              We make no representation or warranty that the Service satisfies any specific regulatory requirements. You acknowledge that laws and regulations vary by jurisdiction and change frequently, and that you will independently verify compliance with all applicable requirements. We shall have no liability arising from your failure to comply with any applicable law or regulation.
            </p>
          </div>
        </Section>

        {/* Contact */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold text-lg">Contact</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p>For questions about these Terms of Service:</p>
              <p className="font-medium text-foreground">{COMPANY_NAME}</p>
              <p>Email: {SUPPORT_EMAIL}</p>
            </div>
          </CardContent>
        </Card>

        {/* Footer acknowledgment */}
        <p className="text-xs text-center text-muted-foreground px-4">
          By using {SERVICE_NAME}, you acknowledge that you have read, understood, and agree to these Terms of Service in their entirety.
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
