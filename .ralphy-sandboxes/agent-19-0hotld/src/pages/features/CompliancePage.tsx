import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, ShieldCheck, FileText, Lock, AlertTriangle, Clock, RefreshCw, Database, Bell, BarChart3 } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SEOHead } from "@/components/SEOHead";
import { ComplianceDemo } from "@/components/marketing/demos/ComplianceDemo";
import { CTASection } from "@/components/marketing/CTASection";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";

const complianceSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "FloraIQ Automated Compliance",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "Automated cannabis compliance software with real-time Metrc integration. Sync every 5 minutes, generate manifests automatically, and stay audit-ready 24/7.",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "14-day free trial"
    },
    "featureList": [
        "Real-time Metrc synchronization",
        "Automated manifest generation",
        "Discrepancy detection and alerts",
        "Audit-ready reporting",
        "AES-256 encryption",
        "Multi-state compliance support"
    ]
};

const features = [
    {
        icon: RefreshCw,
        title: "5-Minute Sync Cycles",
        description: "Your data syncs with Metrc every 5 minutes automatically. Never worry about stale data or manual uploads again."
    },
    {
        icon: FileText,
        title: "Auto-Generated Manifests",
        description: "Transfer manifests are created and validated in real-time as orders are processed. Zero manual data entry required."
    },
    {
        icon: AlertTriangle,
        title: "Discrepancy Detection",
        description: "Our AI flags inventory mismatches before they become compliance violations. Get alerted instantly via SMS or email."
    },
    {
        icon: Clock,
        title: "Audit Trail History",
        description: "Every transaction, adjustment, and sync is logged with timestamps. Pull any report for any date range in seconds."
    },
    {
        icon: Database,
        title: "Multi-State Support",
        description: "Operating in multiple states? FloraIQ automatically handles different regulatory frameworks—Metrc, BioTrack, and more."
    },
    {
        icon: Bell,
        title: "Proactive Alerts",
        description: "Get notified before licenses expire, when inventory thresholds are low, or when unusual activity is detected."
    }
];

const stats = [
    { value: "99.9%", label: "Sync Uptime" },
    { value: "5 min", label: "Sync Interval" },
    { value: "0", label: "Manual Entry" },
    { value: "24/7", label: "Audit Ready" }
];

const faqs = [
    {
        question: "How does FloraIQ integrate with Metrc?",
        answer: "FloraIQ uses the official Metrc API to sync data bidirectionally. We push your sales, transfers, and adjustments automatically while pulling license and package data. Setup takes under 15 minutes with your Metrc API key."
    },
    {
        question: "What happens if there's a sync error?",
        answer: "Our system retries failed syncs automatically and alerts your team immediately. We maintain a queue of pending operations so nothing is ever lost. Most issues resolve within one retry cycle."
    },
    {
        question: "Is my data secure?",
        answer: "Absolutely. All data is encrypted with AES-256 at rest and TLS 1.3 in transit. We're SOC 2 Type II compliant and undergo annual penetration testing. Your compliance data is safer with us than on paper."
    },
    {
        question: "Do you support states other than Colorado?",
        answer: "Yes! FloraIQ supports Metrc-integrated states including California, Oregon, Michigan, Oklahoma, and more. We also integrate with BioTrack and Leaf Data Systems for additional state coverage."
    }
];

export default function CompliancePage() {
    return (
        <ForceLightMode>
            <div className="min-h-dvh bg-slate-50 font-sans text-slate-900">
                <SEOHead
                    title="Automated Cannabis Compliance Software | Metrc Integration | FloraIQ"
                    description="Stay audit-ready 24/7 with FloraIQ's automated compliance platform. Real-time Metrc sync every 5 minutes, auto-generated manifests, discrepancy alerts, and complete audit trail. Start your free trial today."
                    schema={complianceSchema}
                />
                <MarketingNav />

                {/* Hero Section */}
                <section className="pt-32 pb-16 px-4">
                    <div className="container mx-auto max-w-7xl">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                <Link to="/features" className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-6 transition-colors font-medium">
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to Features
                                </Link>

                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold mb-6">
                                    <ShieldCheck className="w-4 h-4" />
                                    Automated Compliance
                                </div>

                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 mb-6 leading-tight">
                                    Audit-Ready,<br />
                                    All The Time.
                                </h1>

                                <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-lg">
                                    State reporting happens automatically in the background. FloraIQ syncs with Metrc every 5 minutes so your manifests are always audit-ready—no manual data entry required.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 mb-12">
                                    <Link to="/signup?plan=free">
                                        <Button size="lg" className="h-12 px-8 rounded-xl bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
                                            Start Free Trial
                                        </Button>
                                    </Link>
                                    <Link to="/demo">
                                        <Button size="lg" variant="outline" className="h-12 px-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-lg">
                                            View Interactive Demo
                                        </Button>
                                    </Link>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        "Real-time Metrc synchronization",
                                        "Automated manifest generation",
                                        "Instant discrepancy alerts"
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <span className="text-lg text-slate-700 font-medium">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 blur-3xl rounded-full opacity-50" />
                                <div className="relative transform hover:scale-[1.02] transition-transform duration-500 perspective-[1000px]">
                                    <ComplianceDemo />

                                    {/* Floating Cards */}
                                    <motion.div
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.6 }}
                                        className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl border border-slate-100 max-w-[200px] hidden md:block"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                <FileText className="w-4 h-4 text-emerald-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500 font-bold uppercase">Last Audit</div>
                                                <div className="text-sm font-bold text-slate-900">Passed</div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Zero discrepancies found in last 30 days.
                                        </div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ y: -20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.8 }}
                                        className="absolute -top-6 -right-6 bg-white p-4 rounded-xl shadow-xl border border-slate-100 max-w-[200px] hidden md:block"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                                <Lock className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-500 font-bold uppercase">Security</div>
                                                <div className="text-sm font-bold text-slate-900">AES-256 Encrypted</div>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* Stats Section */}
                <section className="py-16 bg-white border-y border-slate-100">
                    <div className="container mx-auto max-w-5xl">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                            {stats.map((stat, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    viewport={{ once: true }}
                                    className="text-center"
                                >
                                    <div className="text-4xl md:text-5xl font-bold text-emerald-600 mb-2">{stat.value}</div>
                                    <div className="text-slate-600 font-medium">{stat.label}</div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-24 bg-slate-50">
                    <div className="container mx-auto max-w-7xl px-4">
                        <div className="text-center max-w-3xl mx-auto mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                                Everything You Need to Stay Compliant
                            </h2>
                            <p className="text-lg text-slate-600">
                                From real-time syncing to proactive alerts, FloraIQ handles the compliance heavy lifting so you can focus on growing your business.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {features.map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    viewport={{ once: true }}
                                    className="bg-white p-8 rounded-2xl border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-6">
                                        <feature.icon className="w-6 h-6 text-emerald-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                    <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Why Automate Section */}
                <section className="py-24 bg-white">
                    <div className="container mx-auto max-w-6xl px-4">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                                    Why Automate Compliance?
                                </h2>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    Manual reporting is the #1 cause of license suspensions in the cannabis industry. A single data entry error can trigger an audit, fines, or worse—license revocation.
                                </p>
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                            <AlertTriangle className="w-5 h-5 text-red-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">Human Error Risk</h4>
                                            <p className="text-slate-600">85% of compliance violations stem from manual data entry mistakes.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                            <Clock className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">Time Drain</h4>
                                            <p className="text-slate-600">Average dispensary spends 15+ hours weekly on compliance paperwork.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">FloraIQ Solution</h4>
                                            <p className="text-slate-600">Eliminate human error with automated sync. Reclaim 15+ hours weekly.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200">
                                <BarChart3 className="w-12 h-12 text-emerald-600 mb-6" />
                                <h3 className="text-2xl font-bold text-slate-900 mb-4">The Numbers Don't Lie</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-3 border-b border-slate-200">
                                        <span className="text-slate-600">Compliance violations reduced</span>
                                        <span className="font-bold text-emerald-600">98%</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-slate-200">
                                        <span className="text-slate-600">Hours saved per week</span>
                                        <span className="font-bold text-emerald-600">15+</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-slate-200">
                                        <span className="text-slate-600">Audit pass rate</span>
                                        <span className="font-bold text-emerald-600">100%</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3">
                                        <span className="text-slate-600">Customer satisfaction</span>
                                        <span className="font-bold text-emerald-600">4.9/5</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="py-24 bg-slate-50">
                    <div className="container mx-auto max-w-4xl px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                                Frequently Asked Questions
                            </h2>
                            <p className="text-lg text-slate-600">
                                Everything you need to know about FloraIQ's compliance automation.
                            </p>
                        </div>

                        <div className="space-y-6">
                            {faqs.map((faq, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    viewport={{ once: true }}
                                    className="bg-white p-6 rounded-xl border border-slate-200"
                                >
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">{faq.question}</h3>
                                    <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <CTASection
                    title="Stop worrying about audits."
                    description="Start your 14-day free trial and let FloraIQ handle the compliance heavy lifting. No credit card required."
                    primaryCta={{ text: "Start Free Trial", link: "/signup" }}
                />

                <MarketingFooter />
            </div>
        </ForceLightMode>
    );
}
