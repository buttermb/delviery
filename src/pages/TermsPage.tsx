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
  Leaf,
  Mail,
  Bot,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

const EFFECTIVE_DATE = 'March 20, 2026';
const COMPANY_NAME = 'FloraIQ Inc.';
const SERVICE_NAME = 'FloraIQ';
const SUPPORT_EMAIL = 'legal@floraiq.com';
const DMCA_EMAIL = 'dmca@floraiq.com';
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
                By creating an account, accessing, or using {SERVICE_NAME} in any way, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service, our Privacy Policy, and our Cookie Policy. If you do not agree, you must not use the Service. By using the Service, you also consent to receive electronic communications from us (see Section 4).
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
            <li><strong>&quot;Applicable Cannabis Laws&quot;</strong> means all federal, state, local, tribal, and territorial laws, rules, regulations, ordinances, executive orders, and licensing requirements applicable to the cultivation, manufacture, distribution, transportation, sale, possession, or use of cannabis and cannabis-derived products in the jurisdictions in which you operate.</li>
            <li><strong>&quot;Automated Features&quot;</strong> means any features of the Service that use artificial intelligence, machine learning, or algorithmic processing to generate suggestions, predictions, analytics, or other outputs.</li>
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
            <li>You represent and warrant that you are a duly licensed cannabis business operating in compliance with all Applicable Cannabis Laws in your jurisdiction(s).</li>
            <li>You agree to promptly notify us if any of your licenses or permits are suspended, revoked, denied renewal, or become the subject of any regulatory action.</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">
            We reserve the right to refuse service, terminate accounts, or restrict access at our sole discretion, with or without cause, and with or without notice. We may, but are not obligated to, verify your licensing status at any time.
          </p>
        </Section>

        {/* 3. Cannabis Industry Acknowledgment */}
        <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 overflow-hidden">
          <div className="bg-amber-50 dark:bg-amber-950/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Leaf className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-amber-900 dark:text-amber-200">3. Cannabis Industry Acknowledgment</h3>
                <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700 text-xs mt-1">CRITICAL &mdash; READ CAREFULLY</Badge>
              </div>
            </div>
          </div>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-semibold uppercase">
              FEDERAL LAW NOTICE: CANNABIS REMAINS A SCHEDULE I CONTROLLED SUBSTANCE UNDER THE UNITED STATES CONTROLLED SUBSTANCES ACT (21 U.S.C. &sect; 801 ET SEQ.). THE MANUFACTURE, DISTRIBUTION, DISPENSING, AND POSSESSION OF CANNABIS IS ILLEGAL UNDER FEDERAL LAW REGARDLESS OF STATE OR LOCAL LAWS.
            </p>
            <p className="text-sm">
              {SERVICE_NAME} is a technology platform that provides business management software tools. {COMPANY_NAME} does not cultivate, manufacture, distribute, sell, or possess cannabis or cannabis-derived products. The Service is a neutral software tool and does not facilitate, encourage, or endorse any activity that violates applicable law.
            </p>
            <p className="text-sm">
              BY USING THE SERVICE, YOU ACKNOWLEDGE AND AGREE THAT:
            </p>
            <ul className="space-y-1.5 text-sm list-disc list-inside">
              <li>You are solely responsible for ensuring your business operations comply with all Applicable Cannabis Laws, including but not limited to state licensing requirements, local zoning regulations, and track-and-trace requirements.</li>
              <li>The Service does not constitute legal, regulatory, tax, or compliance advice and is not a substitute for consultation with qualified legal counsel.</li>
              <li>There is inherent legal risk in operating a cannabis business due to the conflict between federal and state law, including but not limited to the risk of federal enforcement action, asset forfeiture, and criminal prosecution.</li>
              <li>You will not use the Service to facilitate interstate commerce in cannabis or cannabis-derived products, which is prohibited under federal law.</li>
              <li>You will not use the Service in any jurisdiction where doing so would violate applicable law.</li>
              <li>{COMPANY_NAME} may be required to comply with federal law, including responding to lawful requests from federal agencies, which may affect your access to the Service or your data.</li>
              <li>{COMPANY_NAME} is not responsible for and does not guarantee compliance with any seed-to-sale tracking, Metrc, BioTrack, or other state-mandated track-and-trace systems. Integration with such systems, if offered, is provided for convenience only and does not relieve you of your independent compliance obligations.</li>
              <li>Changes in federal, state, or local law may affect the availability, features, or legality of the Service in your jurisdiction, and we shall have no liability for any such changes.</li>
            </ul>
            <p className="text-sm">
              YOU ASSUME ALL RISK ARISING FROM THE OPERATION OF A CANNABIS BUSINESS AND THE USE OF THE SERVICE IN CONNECTION THEREWITH. {COMPANY_NAME.toUpperCase()} SHALL HAVE NO LIABILITY FOR ANY LOSSES, DAMAGES, PENALTIES, FINES, OR OTHER CONSEQUENCES ARISING FROM YOUR FAILURE TO COMPLY WITH APPLICABLE CANNABIS LAWS OR FROM THE INHERENT LEGAL RISKS OF THE CANNABIS INDUSTRY.
            </p>
          </CardContent>
        </div>

        {/* 4. Electronic Communications Consent */}
        <Section
          icon={<Mail className="h-5 w-5 text-sky-600 dark:text-sky-400" />}
          iconBg="bg-sky-50 dark:bg-sky-950/50"
          title="4. Consent to Electronic Communications"
        >
          <div className="space-y-3 text-sm">
            <p>
              By creating an account or using the Service, you consent to receive electronic communications from us, including but not limited to: account notifications, billing statements, service updates, security alerts, legal notices, and promotional materials (subject to your opt-out preferences).
            </p>
            <p>
              In accordance with the Electronic Signatures in Global and National Commerce Act (E-SIGN Act, 15 U.S.C. &sect; 7001 et seq.) and applicable state laws, you agree that:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Electronic communications satisfy any legal requirement that communications be &quot;in writing.&quot;</li>
              <li>Electronic signatures, contracts, and records are legally valid and enforceable.</li>
              <li>You have the hardware and software necessary to receive and retain electronic communications (a device with internet access and a current web browser).</li>
              <li>You will maintain a valid email address in your account settings.</li>
            </ul>
            <p>
              You may withdraw your consent to receive electronic communications by contacting us at {SUPPORT_EMAIL}, but doing so may result in termination of your account, as the Service cannot function without electronic communication.
            </p>
          </div>
        </Section>

        {/* 5. Acceptable Use */}
        <Section
          icon={<FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/50"
          title="5. Acceptable Use"
        >
          <p className="text-sm mb-3">You agree to use the Service only for lawful purposes and in accordance with these Terms. You may:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Use the Service for legitimate wholesale business operations in compliance with all applicable laws</li>
            <li>Create and manage orders, inventory, customers, and financial records</li>
            <li>Access and export your own business data</li>
            <li>Integrate with approved third-party services through our documented APIs</li>
          </ul>
        </Section>

        {/* 6. Prohibited Activities */}
        <Section
          icon={<Ban className="h-5 w-5 text-red-600 dark:text-red-400" />}
          iconBg="bg-red-50 dark:bg-red-950/50"
          title="6. Prohibited Activities"
        >
          <p className="text-sm mb-3">You shall NOT, directly or indirectly:</p>
          <ul className="space-y-1.5 text-sm list-disc list-inside">
            <li>Violate any applicable local, state, national, or international law or regulation</li>
            <li>Conduct business with unlicensed entities or individuals under the legal age</li>
            <li>Use the Service to facilitate the interstate transportation, sale, or distribution of cannabis or cannabis-derived products</li>
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
            <li>Use Automated Features to generate content that is false, misleading, defamatory, or harmful</li>
            <li>Rely on Automated Features as the sole basis for regulatory compliance decisions</li>
          </ul>
        </Section>

        {/* 7. Credit System */}
        <Section
          icon={<Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          title="7. Credit System"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li>Credits are a virtual unit of account with no monetary value outside the Service.</li>
            <li>Credits are non-transferable, non-refundable, and cannot be exchanged for cash.</li>
            <li>Free credits are granted at our sole discretion and may be modified, reduced, or discontinued at any time without notice.</li>
            <li>Unused credits may expire as described in the applicable plan terms.</li>
            <li>We reserve the right to adjust credit balances to correct errors or prevent abuse.</li>
            <li>Purchased credits are subject to the refund terms in Section 8.</li>
            <li>We are not liable for any loss, damage, or inconvenience arising from credit balance changes, expirations, or system adjustments.</li>
          </ul>
        </Section>

        {/* 8. Payment, Billing & Auto-Renewal */}
        <Section
          icon={<CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-50 dark:bg-blue-950/50"
          title="8. Payment, Billing &amp; Refunds"
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
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Auto-Renewal Disclosure</p>
            </div>
            <div className="text-sm space-y-2 text-blue-900 dark:text-blue-200">
              <p>YOUR SUBSCRIPTION WILL AUTOMATICALLY RENEW AT THE END OF EACH BILLING PERIOD (MONTHLY OR ANNUALLY) AT THE THEN-CURRENT RATE UNLESS YOU CANCEL BEFORE THE RENEWAL DATE.</p>
              <p>In compliance with California Business and Professions Code &sect; 17600 et seq. (California Automatic Renewal Law) and New York General Business Law &sect; 527-a:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Your subscription will automatically renew for successive periods of the same duration as the initial term.</li>
                <li>You will be charged the then-current subscription rate for each renewal period.</li>
                <li>You may cancel at any time through your account settings or by emailing {SUPPORT_EMAIL}. Cancellation takes effect at the end of the current billing period.</li>
                <li>We will send you a reminder notification before each renewal. For annual plans, this reminder will be sent at least 30 days before renewal.</li>
                <li>If we materially change the subscription price, we will notify you and obtain your affirmative consent before charging the new rate.</li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            <strong>Banking Disclosure:</strong> Due to the federal legal status of cannabis, some financial institutions may restrict transactions related to cannabis businesses. {COMPANY_NAME} is not responsible for payment processing failures resulting from your financial institution&apos;s policies regarding cannabis-related transactions.
          </p>
        </Section>

        {/* 9. Cancellation & Termination */}
        <Section
          icon={<UserX className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconBg="bg-orange-50 dark:bg-orange-950/50"
          title="9. Cancellation &amp; Termination"
        >
          <div className="space-y-3 text-sm">
            <p><strong>By You:</strong> You may cancel your subscription at any time through your account settings or by emailing {SUPPORT_EMAIL}. Access continues until the end of the current billing period. No partial refunds are issued for the remaining period.</p>
            <p><strong>By Us:</strong> We may suspend, restrict, or terminate your account at any time, with or without notice, for any reason including but not limited to:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Violation of these Terms or any applicable law</li>
              <li>Fraudulent, abusive, or illegal activity</li>
              <li>Non-payment or payment disputes</li>
              <li>Inactivity for 6 or more consecutive months</li>
              <li>Requests from law enforcement or government agencies</li>
              <li>Suspension, revocation, or non-renewal of your cannabis business license(s)</li>
              <li>Changes in applicable law that make the provision of the Service impractical or unlawful</li>
              <li>Discontinuation of the Service (in whole or part)</li>
            </ul>
            <p><strong>Effect of Termination:</strong> Upon termination, your right to use the Service ceases immediately. We may delete your data after 30 days, subject to legal retention requirements. We are not liable for any loss of data, content, or access resulting from termination.</p>
            <p><strong>Survival:</strong> Sections 3, and 10 through 22 survive termination of these Terms.</p>
          </div>
        </Section>

        {/* 10. Intellectual Property & Feedback */}
        <Section
          icon={<Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-50 dark:bg-violet-950/50"
          title="10. Intellectual Property &amp; Feedback"
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
            <p>
              <strong>Feedback:</strong> If you provide suggestions, ideas, feedback, or recommendations regarding the Service (&quot;Feedback&quot;), you hereby assign to {COMPANY_NAME} all rights, title, and interest in such Feedback. We may use, modify, and incorporate Feedback into the Service without any obligation, compensation, or attribution to you. You waive any moral rights in the Feedback to the extent permitted by law.
            </p>
          </div>
        </Section>

        {/* 11. AI & Automated Features */}
        <Section
          icon={<Bot className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          iconBg="bg-cyan-50 dark:bg-cyan-950/50"
          title="11. AI &amp; Automated Features"
        >
          <div className="space-y-3 text-sm">
            <p>
              The Service may include Automated Features that use artificial intelligence, machine learning, or algorithmic processing. These features may include, but are not limited to: predictive analytics, automated suggestions, inventory optimization recommendations, demand forecasting, and AI-assisted content generation.
            </p>
            <p className="font-semibold uppercase">
              BY USING AUTOMATED FEATURES, YOU ACKNOWLEDGE AND AGREE THAT:
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Automated Features generate outputs based on statistical models and algorithms and may produce inaccurate, incomplete, or inappropriate results.</li>
              <li>Automated outputs are suggestions only and do not constitute professional advice (legal, financial, regulatory, or otherwise).</li>
              <li>You are solely responsible for reviewing, validating, and making independent decisions based on any automated output.</li>
              <li>You shall not use automated outputs as the sole basis for regulatory compliance, financial reporting, or other consequential business decisions.</li>
              <li>We may use your Content (in aggregated, de-identified form) to improve Automated Features, unless you opt out through your account settings.</li>
              <li>We make no warranty regarding the accuracy, reliability, or fitness for purpose of any automated output.</li>
              <li>We are not liable for any loss, damage, or consequence arising from your reliance on automated outputs.</li>
            </ul>
            <p>
              In compliance with GDPR Article 22, if any Automated Feature makes a decision that produces legal effects concerning you or similarly significantly affects you solely based on automated processing, you have the right to: (a) obtain human intervention; (b) express your point of view; and (c) contest the decision. To exercise these rights, contact us at {SUPPORT_EMAIL}.
            </p>
          </div>
        </Section>

        {/* 12. Disclaimer of Warranties */}
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 overflow-hidden">
          <div className="bg-red-50 dark:bg-red-950/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-red-900 dark:text-red-200">12. Disclaimer of Warranties</h3>
                <Badge variant="outline" className="text-red-600 border-red-300 dark:text-red-400 dark:border-red-700 text-xs mt-1">IMPORTANT &mdash; READ CAREFULLY</Badge>
              </div>
            </div>
          </div>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-semibold uppercase">
              THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-sm">
              WE DO NOT WARRANT THAT: (A) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; (B) THE RESULTS OBTAINED FROM THE SERVICE WILL BE ACCURATE, RELIABLE, OR COMPLETE; (C) THE SERVICE WILL MEET YOUR REQUIREMENTS OR EXPECTATIONS; (D) ANY ERRORS OR DEFECTS WILL BE CORRECTED; (E) THE SERVICE IS FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS; OR (F) THE SERVICE SATISFIES ANY REGULATORY OR COMPLIANCE REQUIREMENTS APPLICABLE TO YOUR BUSINESS.
            </p>
            <p className="text-sm">
              YOU ACKNOWLEDGE THAT YOU USE THE SERVICE ENTIRELY AT YOUR OWN RISK. WE ARE NOT RESPONSIBLE FOR ANY DECISIONS MADE OR ACTIONS TAKEN BASED ON INFORMATION PROVIDED THROUGH THE SERVICE, INCLUDING BUT NOT LIMITED TO INVENTORY MANAGEMENT, PRICING, ORDER FULFILLMENT, FINANCIAL REPORTING, REGULATORY COMPLIANCE DECISIONS, OR ANY OUTPUT FROM AUTOMATED FEATURES.
            </p>
            <p className="text-sm">
              WE MAKE NO REPRESENTATIONS REGARDING THE ACCURACY, COMPLETENESS, OR TIMELINESS OF ANY DATA, CALCULATIONS, ANALYTICS, OR AUTOMATED OUTPUTS PROVIDED BY THE SERVICE. YOU ARE SOLELY RESPONSIBLE FOR INDEPENDENTLY VERIFYING ALL INFORMATION BEFORE RELYING ON IT.
            </p>
            <p className="text-sm">
              WE DO NOT WARRANT THAT THE SERVICE WILL BE COMPATIBLE WITH ANY PARTICULAR SEED-TO-SALE TRACKING SYSTEM, STATE REPORTING REQUIREMENT, OR REGULATORY FRAMEWORK, OR THAT DATA EXPORTED FROM THE SERVICE WILL SATISFY ANY SPECIFIC GOVERNMENTAL FILING OR REPORTING OBLIGATION.
            </p>
          </CardContent>
        </div>

        {/* 13. Limitation of Liability */}
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 overflow-hidden">
          <div className="bg-red-50 dark:bg-red-950/40 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <Gavel className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-red-900 dark:text-red-200">13. Limitation of Liability</h3>
                <Badge variant="outline" className="text-red-600 border-red-300 dark:text-red-400 dark:border-red-700 text-xs mt-1">IMPORTANT &mdash; READ CAREFULLY</Badge>
              </div>
            </div>
          </div>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-semibold uppercase">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL {COMPANY_NAME.toUpperCase()}, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO: LOSS OF PROFITS, REVENUE, GOODWILL, DATA, BUSINESS OPPORTUNITIES, OR ANTICIPATED SAVINGS; BUSINESS INTERRUPTION; COST OF PROCUREMENT OF SUBSTITUTE SERVICES; REGULATORY FINES OR PENALTIES; LOSS OR SUSPENSION OF CANNABIS LICENSES; OR ANY OTHER INTANGIBLE LOSSES, REGARDLESS OF THE THEORY OF LIABILITY (CONTRACT, TORT, STRICT LIABILITY, OR OTHERWISE), EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="text-sm font-semibold uppercase">
              OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE LESSER OF: (A) THE TOTAL AMOUNT YOU PAID US IN THE SIX (6) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100.00 USD).
            </p>
            <p className="text-sm">
              THE FOREGOING LIMITATIONS APPLY EVEN IF A REMEDY FAILS ITS ESSENTIAL PURPOSE. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES, SO SOME OF THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU. IN SUCH CASES, OUR LIABILITY SHALL BE LIMITED TO THE FULLEST EXTENT PERMITTED BY LAW.
            </p>
          </CardContent>
        </div>

        {/* 14. Indemnification */}
        <Section
          icon={<Shield className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
          iconBg="bg-rose-50 dark:bg-rose-950/50"
          title="14. Indemnification"
        >
          <p className="text-sm">
            You agree to indemnify, defend, and hold harmless {COMPANY_NAME}, its affiliates, officers, directors, employees, agents, suppliers, and licensors from and against all claims, demands, actions, liabilities, damages, losses, costs, and expenses (including reasonable attorneys&apos; fees and court costs) arising out of or relating to: (a) your use of or access to the Service; (b) your violation of these Terms; (c) your violation of any applicable law or regulation, including Applicable Cannabis Laws; (d) your Content or data; (e) your interaction with any third party through the Service; (f) your negligence or willful misconduct; (g) any claim that your use of the Service infringes or violates any third-party intellectual property right; or (h) any regulatory action, fine, penalty, or enforcement proceeding arising from your business operations. This indemnification obligation survives termination of these Terms and your use of the Service.
          </p>
        </Section>

        {/* 15. Dispute Resolution & Arbitration */}
        <Section
          icon={<Gavel className="h-5 w-5 text-slate-600 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          title="15. Dispute Resolution &amp; Arbitration"
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
            <p>
              <strong>Time Limitation on Claims:</strong> ANY CLAIM OR CAUSE OF ACTION ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE MUST BE COMMENCED WITHIN TWELVE (12) MONTHS AFTER THE CLAIM OR CAUSE OF ACTION ACCRUES. CLAIMS BROUGHT AFTER THIS PERIOD ARE PERMANENTLY BARRED. This limitation applies to the fullest extent permitted by applicable law.
            </p>
          </div>
        </Section>

        {/* 16. Third-Party Services */}
        <Section
          icon={<Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          iconBg="bg-cyan-50 dark:bg-cyan-950/50"
          title="16. Third-Party Services &amp; Integrations"
        >
          <p className="text-sm">
            The Service may integrate with, link to, or rely upon third-party services (including payment processors, mapping providers, analytics platforms, and cloud infrastructure). We are not responsible for the availability, accuracy, content, policies, or practices of any third-party service. Your use of third-party services is governed by their respective terms and policies. We disclaim all liability for any loss or damage arising from your reliance on or use of third-party services, including but not limited to payment processing failures, data breaches at third-party providers, or service outages beyond our control.
          </p>
        </Section>

        {/* 17. Service Availability & Modifications */}
        <Section
          icon={<Server className="h-5 w-5 text-teal-600 dark:text-teal-400" />}
          iconBg="bg-teal-50 dark:bg-teal-950/50"
          title="17. Service Availability &amp; Modifications"
        >
          <ul className="space-y-2 text-sm list-disc list-inside">
            <li>We may modify, suspend, or discontinue the Service (or any part thereof) at any time, with or without notice, and without liability to you.</li>
            <li>We do not guarantee any specific uptime, availability, or performance level unless expressly stated in a separate written service level agreement.</li>
            <li>Scheduled and unscheduled maintenance may result in temporary service disruptions.</li>
            <li>Features described as &quot;beta,&quot; &quot;experimental,&quot; or &quot;preview&quot; are provided without any warranty and may be removed at any time.</li>
            <li>We are not liable for any damages arising from modifications, suspensions, or discontinuation of the Service.</li>
          </ul>
        </Section>

        {/* 18. Export Controls & Sanctions */}
        <Section
          icon={<ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />}
          iconBg="bg-red-50 dark:bg-red-950/50"
          title="18. Export Controls &amp; Sanctions"
        >
          <div className="space-y-3 text-sm">
            <p>
              The Service may be subject to United States export control and economic sanctions laws and regulations, including the Export Administration Regulations (EAR) administered by the Bureau of Industry and Security and the sanctions regulations administered by the Office of Foreign Assets Control (OFAC).
            </p>
            <p>You represent and warrant that:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>You are not located in, organized under the laws of, or a resident of any country or territory subject to comprehensive U.S. sanctions (currently Cuba, Iran, North Korea, Syria, and the Crimea, Donetsk, and Luhansk regions of Ukraine).</li>
              <li>You are not designated on any U.S. government restricted party list, including the OFAC Specially Designated Nationals (SDN) List, the Commerce Department&apos;s Entity List, or the Denied Persons List.</li>
              <li>You will not use the Service in violation of any applicable export control or sanctions laws.</li>
            </ul>
          </div>
        </Section>

        {/* 19. DMCA & Copyright */}
        <Section
          icon={<MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
          iconBg="bg-purple-50 dark:bg-purple-950/50"
          title="19. DMCA &amp; Copyright Complaints"
        >
          <div className="space-y-3 text-sm">
            <p>
              We respect the intellectual property rights of others. If you believe that any Content on the Service infringes your copyright, you may submit a notification pursuant to the Digital Millennium Copyright Act (DMCA, 17 U.S.C. &sect; 512) to our designated agent:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Email: {DMCA_EMAIL}</li>
              <li>Subject line: &quot;DMCA Takedown Notice&quot;</li>
            </ul>
            <p>Your notification must include:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Identification of the copyrighted work claimed to have been infringed.</li>
              <li>Identification of the material that is claimed to be infringing and information sufficient to locate it.</li>
              <li>Your contact information (name, address, telephone number, email).</li>
              <li>A statement that you have a good faith belief that the use of the material is not authorized.</li>
              <li>A statement, under penalty of perjury, that the information in the notification is accurate and that you are the copyright owner or authorized to act on behalf of the owner.</li>
              <li>Your physical or electronic signature.</li>
            </ul>
            <p>
              We may terminate the accounts of repeat infringers in appropriate circumstances.
            </p>
          </div>
        </Section>

        {/* 20. Force Majeure */}
        <Section
          icon={<Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />}
          iconBg="bg-yellow-50 dark:bg-yellow-950/50"
          title="20. Force Majeure"
        >
          <p className="text-sm">
            We shall not be liable for any failure or delay in performing our obligations where such failure or delay results from circumstances beyond our reasonable control, including but not limited to: acts of God, natural disasters, pandemics, epidemics, war, terrorism, riots, civil unrest, government actions, sanctions, embargoes, changes in applicable law (including cannabis-related laws), labor disputes, strikes, fire, flood, earthquake, power outages, internet service disruptions, cyberattacks, telecommunications failures, or failures of third-party service providers.
          </p>
        </Section>

        {/* 21. Governing Law & General Provisions */}
        <Section
          icon={<Scale className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/50"
          title="21. Governing Law &amp; General Provisions"
        >
          <div className="space-y-3 text-sm">
            <p><strong>Governing Law:</strong> These Terms are governed by and construed in accordance with the laws of the State of New York, without regard to its conflict of law provisions.</p>
            <p><strong>Severability:</strong> If any provision of these Terms is held to be invalid or unenforceable, such provision shall be modified to the minimum extent necessary to make it valid and enforceable, and the remaining provisions shall remain in full force and effect.</p>
            <p><strong>Entire Agreement:</strong> These Terms, together with the Privacy Policy, Cookie Policy, and any other agreements expressly incorporated by reference, constitute the entire agreement between you and {COMPANY_NAME} regarding the Service and supersede all prior agreements, understandings, and communications, whether written or oral.</p>
            <p><strong>Waiver:</strong> Our failure to enforce any provision of these Terms shall not constitute a waiver of that provision or any other provision. A waiver of any provision is effective only if in writing and signed by {COMPANY_NAME}.</p>
            <p><strong>Assignment:</strong> You may not assign or transfer these Terms or your rights hereunder without our prior written consent. We may assign these Terms without restriction, including in connection with a merger, acquisition, or sale of assets.</p>
            <p><strong>Notices:</strong> We may provide notices to you via email, in-app notification, or by posting on the Service. Notices to us must be sent to {SUPPORT_EMAIL}. Notices are deemed delivered upon sending (email), posting (in-app), or 3 business days after mailing (postal mail).</p>
            <p><strong>Headings:</strong> Section headings are for convenience only and do not affect the interpretation of these Terms.</p>
            <p><strong>No Third-Party Beneficiaries:</strong> These Terms do not create any third-party beneficiary rights.</p>
            <p><strong>Modifications:</strong> We reserve the right to modify these Terms at any time. Material changes will be communicated with at least 15 days&apos; notice via email or in-app notification. Your continued use of the Service after such notice constitutes acceptance of the modified Terms. If you do not agree, you must stop using the Service before the changes take effect.</p>
          </div>
        </Section>

        {/* 22. Regulatory & Compliance Disclaimer */}
        <Section
          icon={<AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-950/50"
          title="22. Regulatory &amp; Compliance Disclaimer"
        >
          <div className="space-y-3 text-sm">
            <p>
              {SERVICE_NAME} is a software tool designed to assist with business operations. THE SERVICE DOES NOT PROVIDE LEGAL, REGULATORY, TAX, FINANCIAL, OR COMPLIANCE ADVICE. You are solely responsible for ensuring that your use of the Service and your business operations comply with all applicable federal, state, local, and tribal laws, regulations, ordinances, and licensing requirements, including all Applicable Cannabis Laws.
            </p>
            <p>
              We make no representation or warranty that the Service satisfies any specific regulatory requirements, including but not limited to: state seed-to-sale tracking requirements, Metrc or BioTrack integration mandates, state or local reporting obligations, tax calculation or filing requirements, or any other governmental compliance standard.
            </p>
            <p>
              You acknowledge that laws and regulations governing the cannabis industry vary by jurisdiction and change frequently. You are responsible for independently monitoring and complying with all applicable requirements. We shall have no liability arising from your failure to comply with any applicable law or regulation, including any fine, penalty, license suspension or revocation, or enforcement action.
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
              <p>Legal: {SUPPORT_EMAIL}</p>
              <p>Copyright: {DMCA_EMAIL}</p>
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
