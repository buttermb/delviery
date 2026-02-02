import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import Package from "lucide-react/dist/esm/icons/package";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Users from "lucide-react/dist/esm/icons/users";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import Repeat from "lucide-react/dist/esm/icons/repeat";
import Tag from "lucide-react/dist/esm/icons/tag";
import Clock from "lucide-react/dist/esm/icons/clock";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SEOHead } from "@/components/SEOHead";
import { StorefrontDemo } from "@/components/marketing/demos/StorefrontDemo";
import { CTASection } from "@/components/marketing/CTASection";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";

const ecommerceSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "FloraIQ B2B E-Commerce",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "description": "B2B cannabis e-commerce platform with live inventory, custom pricing tiers, and one-click reordering. Give retailers a modern wholesale ordering experience.",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "14-day free trial"
    },
    "featureList": [
        "Live inventory synchronization",
        "Custom price tiers per customer",
        "One-click reordering",
        "White-label storefront",
        "Payment processing integration",
        "Order analytics dashboard"
    ]
};

const features = [
    {
        icon: Package,
        title: "Live Inventory Feed",
        description: "Your digital menu updates in real-time as warehouse stock changes. No more overselling or disappointed customers expecting out-of-stock items."
    },
    {
        icon: Tag,
        title: "Custom Price Tiers",
        description: "Set different pricing for each customer class—dispensaries, wholesalers, VIPs. Prices update automatically when customers log in to their portal."
    },
    {
        icon: Repeat,
        title: "One-Click Reordering",
        description: "Retailers can reorder their usual products with a single click. Order history and favorites make repeat purchasing effortless."
    },
    {
        icon: Smartphone,
        title: "Mobile-First Design",
        description: "Your buyers order on their phones between tasks. Our mobile-optimized interface makes it easy to browse, search, and checkout anywhere."
    },
    {
        icon: CreditCard,
        title: "Integrated Payments",
        description: "Accept credit cards, ACH transfers, or net terms. Payment processing is built in with automatic invoicing and receipt generation."
    },
    {
        icon: BarChart3,
        title: "Analytics Dashboard",
        description: "See which products sell best, which customers order most, and identify trends. Data-driven insights help you stock smarter."
    }
];

const stats = [
    { value: "3x", label: "Order Frequency" },
    { value: "42%", label: "Larger Basket Size" },
    { value: "2 min", label: "Avg. Order Time" },
    { value: "24/7", label: "Always Open" }
];

const faqs = [
    {
        question: "Can I customize the storefront with my branding?",
        answer: "Absolutely! Your storefront features your logo, brand colors, and custom domain. Retailers see your brand, not ours. We provide a white-label solution that looks and feels like your own custom-built platform."
    },
    {
        question: "How does inventory sync work?",
        answer: "FloraIQ pulls inventory levels from your warehouse management system in real-time. When stock changes in your WMS, it updates on your storefront within seconds. We support integrations with all major cannabis inventory platforms."
    },
    {
        question: "What payment methods can retailers use?",
        answer: "We support credit cards, ACH bank transfers, and net terms (invoicing). You control which payment methods are available to each customer tier. Payment processing fees are competitive with Stripe/Square rates."
    },
    {
        question: "Can retailers place orders after hours?",
        answer: "Yes! Your online store is open 24/7. Retailers can browse inventory, place orders, and check on delivery status anytime. Orders placed after hours are queued for next-day processing or your custom schedule."
    }
];

const testimonials = [
    {
        quote: "Our retailers order 3x more often now that they can browse and reorder from their phones. Revenue is up 40% since switching to FloraIQ.",
        author: "Sarah M.",
        role: "Operations Director",
        company: "Green Mountain Wholesale"
    },
    {
        quote: "No more sending PDF menus by email. Our buyers love having real-time inventory and their custom pricing all in one place.",
        author: "Mike T.",
        role: "Sales Manager",
        company: "Pacific Coast Cultivators"
    }
];

export default function EcommercePage() {
    return (
        <ForceLightMode>
            <div className="min-h-dvh bg-slate-50 font-sans text-slate-900">
                <SEOHead
                    title="B2B Cannabis E-Commerce Platform | Wholesale Ordering Portal | FloraIQ"
                    description="Give your retailers a modern B2B ordering experience. Live inventory sync, custom price tiers, one-click reordering, and 24/7 online ordering. Retailers order 3x more often. Start your free trial."
                    schema={ecommerceSchema}
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

                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold mb-6">
                                    <ShoppingCart className="w-4 h-4" />
                                    B2B E-Commerce
                                </div>

                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 mb-6 leading-tight">
                                    Your Brand,<br />
                                    Their Pocket.
                                </h1>

                                <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-lg">
                                    Give your retailers a modern wholesale ordering experience. Your live menu is always up to date with warehouse inventory, with custom pricing for each customer tier.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 mb-12">
                                    <Link to="/signup?plan=free">
                                        <Button size="lg" className="h-12 px-8 rounded-xl bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
                                            Build Your Store
                                        </Button>
                                    </Link>
                                    <Link to="/demo">
                                        <Button size="lg" variant="outline" className="h-12 px-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-lg">
                                            See Store Examples
                                        </Button>
                                    </Link>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        "Real-time inventory synchronization",
                                        "Custom price tiers per customer",
                                        "One-click reordering from order history"
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-purple-600" />
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
                                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-pink-500/20 blur-3xl rounded-full opacity-50" />
                                <div className="relative transform hover:scale-[1.02] transition-transform duration-500 perspective-[1000px]">
                                    <div className="w-full h-[600px] overflow-hidden rounded-xl border border-slate-200 shadow-2xl bg-white">
                                        <StorefrontDemo />
                                    </div>
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
                                    <div className="text-4xl md:text-5xl font-bold text-purple-600 mb-2">{stat.value}</div>
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
                                Everything You Need to Sell Wholesale Online
                            </h2>
                            <p className="text-lg text-slate-600">
                                From live inventory to payment processing, FloraIQ gives you a complete B2B e-commerce platform built for cannabis.
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
                                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-6">
                                        <feature.icon className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                    <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Why Digital Wholesale */}
                <section className="py-24 bg-white">
                    <div className="container mx-auto max-w-6xl px-4">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                                    Stop Sending PDF Menus
                                </h2>
                                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                    PDF price lists are outdated the moment you send them. Inventory changes, prices fluctuate, and your buyers are stuck with stale information.
                                </p>
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                            <Clock className="w-5 h-5 text-red-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">Outdated Inventory</h4>
                                            <p className="text-slate-600">PDFs don't update. Buyers order items you've already sold.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                            <Users className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">Generic Pricing</h4>
                                            <p className="text-slate-600">One PDF for everyone means no personalized pricing tiers.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                                            <ShoppingCart className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-1">FloraIQ Solution</h4>
                                            <p className="text-slate-600">Live inventory, personalized pricing, instant ordering—all in one.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-2xl border border-purple-100">
                                <DollarSign className="w-12 h-12 text-purple-600 mb-6" />
                                <h3 className="text-2xl font-bold text-slate-900 mb-4">The Revenue Impact</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-3 border-b border-purple-200">
                                        <span className="text-slate-600">Order frequency increase</span>
                                        <span className="font-bold text-purple-600">3x</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-purple-200">
                                        <span className="text-slate-600">Average basket size increase</span>
                                        <span className="font-bold text-purple-600">42%</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3 border-b border-purple-200">
                                        <span className="text-slate-600">Customer retention rate</span>
                                        <span className="font-bold text-purple-600">94%</span>
                                    </div>
                                    <div className="flex justify-between items-center py-3">
                                        <span className="text-slate-600">Average revenue increase</span>
                                        <span className="font-bold text-purple-600">+40%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Testimonials */}
                <section className="py-24 bg-slate-50">
                    <div className="container mx-auto max-w-5xl px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                                Trusted by Leading Distributors
                            </h2>
                            <p className="text-lg text-slate-600">
                                See what our customers say about FloraIQ's B2B platform.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            {testimonials.map((testimonial, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    viewport={{ once: true }}
                                    className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"
                                >
                                    <p className="text-lg text-slate-700 mb-6 leading-relaxed italic">
                                        "{testimonial.quote}"
                                    </p>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-lg font-bold text-purple-600">
                                            {testimonial.author.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{testimonial.author}</div>
                                            <div className="text-sm text-slate-600">{testimonial.role}, {testimonial.company}</div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="py-24 bg-white">
                    <div className="container mx-auto max-w-4xl px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                                Frequently Asked Questions
                            </h2>
                            <p className="text-lg text-slate-600">
                                Everything you need to know about FloraIQ's B2B e-commerce platform.
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
                                    className="bg-slate-50 p-6 rounded-xl border border-slate-200"
                                >
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">{faq.question}</h3>
                                    <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                <CTASection
                    title="Ready to sell more?"
                    description="Retailers order 3x more often when they have a digital catalog. Start your 14-day free trial today and see the difference."
                    primaryCta={{ text: "Launch Your Store", link: "/signup" }}
                />

                <MarketingFooter />
            </div>
        </ForceLightMode>
    );
}
