import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Truck, MapPin, Navigation, Clock, Fuel, Users, Route, Smartphone, FileCheck, Zap } from "lucide-react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SEOHead } from "@/components/SEOHead";
import { LogisticsDemo } from "@/components/marketing/demos/LogisticsDemo";
import { CTASection } from "@/components/marketing/CTASection";
import { ForceLightMode } from "@/components/marketing/ForceLightMode";

const logisticsSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "FloraIQ Smart Logistics",
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web, iOS, Android",
    "description": "Intelligent cannabis delivery route optimization software. Reduce fuel costs by 30%, increase stops per hour, and track drivers in real-time with proof of delivery.",
    "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "14-day free trial"
    },
    "featureList": [
        "Algorithmic route optimization",
        "Real-time driver tracking",
        "Proof of delivery with e-signature",
        "Multi-stop optimization",
        "Traffic-aware routing",
        "Driver mobile app"
    ]
};

const features = [
    {
        icon: Route,
        title: "Algorithmic Route Optimization",
        description: "Our AI considers traffic patterns, delivery windows, vehicle capacity, and driver availability to build the most efficient routes automatically."
    },
    {
        icon: MapPin,
        title: "Real-Time GPS Tracking",
        description: "Know exactly where every driver is at all times. Customers get live ETA updates and your dispatch team has full visibility."
    },
    {
        icon: FileCheck,
        title: "Digital Proof of Delivery",
        description: "Capture e-signatures, photos, and GPS coordinates at every stop. Compliance documentation is automatic and tamper-proof."
    },
    {
        icon: Smartphone,
        title: "Driver Mobile App",
        description: "Drivers get turn-by-turn navigation, customer info, and delivery instructions. Works offline in areas with poor cell coverage."
    },
    {
        icon: Clock,
        title: "Delivery Windows",
        description: "Set customer-specific time windows and priority levels. The algorithm ensures VIP customers always get their preferred slots."
    },
    {
        icon: Zap,
        title: "Dynamic Re-Routing",
        description: "Traffic jam? Cancelled order? The system re-optimizes routes on the fly and notifies affected customers automatically."
    }
];

const stats = [
    { value: "30%", label: "Fuel Savings" },
    { value: "2.5x", label: "More Stops/Hour" },
    { value: "99.4%", label: "On-Time Rate" },
    { value: "< 2min", label: "Route Calculation" }
];

const faqs = [
    {
        question: "How does route optimization work?",
        answer: "FloraIQ uses advanced algorithms that factor in real-time traffic, delivery time windows, vehicle capacity, driver locations, and historical data to calculate the optimal sequence of stops. Routes are recalculated dynamically as conditions change throughout the day."
    },
    {
        question: "What devices do drivers need?",
        answer: "The FloraIQ Driver App works on any iOS or Android smartphone. We recommend devices with GPS capability for accurate tracking. The app is lightweight and works reliably even on older devices or in areas with spotty cell coverage."
    },
    {
        question: "Can customers track their deliveries?",
        answer: "Yes! Customers receive real-time SMS/email updates with a tracking link. They can see their driver's location, estimated arrival time, and receive notifications when the driver is approaching."
    },
    {
        question: "How do you handle cannabis delivery compliance?",
        answer: "Every delivery captures required compliance data: GPS coordinates, timestamps, e-signatures, and ID verification photos. This data syncs to your Metrc account automatically, ensuring chain of custody documentation is always complete."
    }
];

export default function LogisticsPage() {
    return (
        <ForceLightMode>
            <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
                <SEOHead
                    title="Smart Cannabis Delivery Route Optimization | Driver Tracking | FloraIQ"
                    description="Reduce fuel costs by 30% and increase delivery stops per hour with FloraIQ's intelligent route optimization. Real-time GPS tracking, proof of delivery, and driver mobile app. Start your free trial."
                    schema={logisticsSchema}
                />
                <MarketingNav />

                {/* Hero Section */}
                <section className="pt-32 pb-16 px-4">
                    <div className="container mx-auto max-w-7xl">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            {/* Content Left */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                <Link to="/features" className="inline-flex items-center text-slate-500 hover:text-slate-900 mb-6 transition-colors font-medium">
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to Features
                                </Link>

                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-6">
                                    <Truck className="w-4 h-4" />
                                    Smart Logistics
                                </div>

                                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 mb-6 leading-tight">
                                    Deliver Faster,<br />
                                    Route Smarter.
                                </h1>

                                <p className="text-xl text-slate-600 mb-8 leading-relaxed max-w-lg">
                                    Maximize driver efficiency with AI-powered route planning. Reduce fuel costs by 30% and double your stops per hour with our intelligent dispatch engine.
                                </p>

                                <div className="flex flex-col sm:flex-row gap-4 mb-12">
                                    <Link to="/signup?plan=free">
                                        <Button size="lg" className="h-12 px-8 rounded-xl bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]">
                                            Start Routing Free
                                        </Button>
                                    </Link>
                                    <Link to="/demo">
                                        <Button size="lg" variant="outline" className="h-12 px-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-lg">
                                            See Live Map Demo
                                        </Button>
                                    </Link>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        "AI-powered multi-stop optimization",
                                        "Real-time driver mobile app",
                                        "Digital proof of delivery (e-signature + photo)"
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <span className="text-lg text-slate-700 font-medium">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Demo Right */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 blur-3xl rounded-full opacity-50" />
                                <div className="relative transform hover:scale-[1.02] transition-transform duration-500 perspective-[1000px]">
                                    <div className="w-full h-[600px] overflow-hidden rounded-xl border border-slate-200 shadow-2xl bg-white relative">
                                        <LogisticsDemo />

                                        {/* Overlay Stats Card */}
                                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-3 rounded-lg border border-slate-200 shadow-lg max-w-[180px]">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-xs font-bold text-slate-900">LIVE DISPATCH</span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">Active Drivers</span>
                                                    <span className="font-mono font-bold text-slate-900">24</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">On-Time Rate</span>
                                                    <span className="font-mono font-bold text-emerald-600">99.4%</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-slate-500">Today's Stops</span>
                                                    <span className="font-mono font-bold text-slate-900">847</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Driver Card Overlay */}
                                        <div className="absolute bottom-4 left-4 right-4 bg-white p-3 rounded-xl border border-slate-200 shadow-xl flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">
                                                🚛
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-xs text-slate-500 font-bold uppercase">Stop 4 / 8</div>
                                                <div className="text-sm font-bold text-slate-900">Green Relief Co.</div>
                                                <div className="text-xs text-slate-500">124 Main St, Denver</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-emerald-600 font-medium">ETA 4 min</div>
                                                <div className="text-sm font-bold text-slate-900">COD: $1,250</div>
                                            </div>
                                        </div>
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
                                    <div className="text-4xl md:text-5xl font-bold text-blue-600 mb-2">{stat.value}</div>
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
                                Powerful Features for Modern Delivery
                            </h2>
                            <p className="text-lg text-slate-600">
                                From route optimization to proof of delivery, FloraIQ gives you complete control over your delivery operations.
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
                                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-6">
                                        <feature.icon className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                    <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section className="py-24 bg-white">
                    <div className="container mx-auto max-w-6xl px-4">
                        <div className="text-center max-w-3xl mx-auto mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                                How Route Optimization Works
                            </h2>
                            <p className="text-lg text-slate-600">
                                Our intelligent engine handles the complexity so your drivers can focus on delivering.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            {[
                                {
                                    step: "1",
                                    title: "Import Your Orders",
                                    description: "Orders flow in automatically from your POS, e-commerce platform, or manual entry. Each order includes address, time window, and special instructions."
                                },
                                {
                                    step: "2",
                                    title: "AI Builds Optimal Routes",
                                    description: "Our algorithm considers traffic, time windows, vehicle capacity, and driver locations to create the fastest possible routes—in under 2 minutes."
                                },
                                {
                                    step: "3",
                                    title: "Drivers Deliver & Document",
                                    description: "Drivers follow turn-by-turn navigation, capture e-signatures, and the system updates customers automatically. Everything syncs in real-time."
                                }
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    viewport={{ once: true }}
                                    className="text-center"
                                >
                                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
                                        <span className="text-2xl font-bold text-blue-600">{item.step}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                                    <p className="text-slate-600 leading-relaxed">{item.description}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Savings Calculator */}
                <section className="py-24 bg-slate-50">
                    <div className="container mx-auto max-w-4xl px-4">
                        <div className="bg-white p-8 md:p-12 rounded-2xl border border-slate-200 shadow-lg">
                            <div className="text-center mb-12">
                                <Fuel className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                                <h2 className="text-3xl font-bold text-slate-900 mb-4">Calculate Your Savings</h2>
                                <p className="text-lg text-slate-600">
                                    See how much FloraIQ can save your delivery operation.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center py-4 border-b border-slate-200">
                                        <span className="text-slate-600">Average fuel savings</span>
                                        <span className="font-bold text-2xl text-blue-600">30%</span>
                                    </div>
                                    <div className="flex justify-between items-center py-4 border-b border-slate-200">
                                        <span className="text-slate-600">Driver efficiency increase</span>
                                        <span className="font-bold text-2xl text-blue-600">2.5x</span>
                                    </div>
                                    <div className="flex justify-between items-center py-4">
                                        <span className="text-slate-600">Dispatch time reduction</span>
                                        <span className="font-bold text-2xl text-blue-600">90%</span>
                                    </div>
                                </div>
                                <div className="bg-blue-50 p-6 rounded-xl">
                                    <h4 className="font-bold text-slate-900 mb-4">Example: 10-Driver Fleet</h4>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Monthly fuel cost (before)</span>
                                            <span className="font-mono text-slate-900">$15,000</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Monthly fuel cost (after)</span>
                                            <span className="font-mono text-emerald-600">$10,500</span>
                                        </div>
                                        <div className="flex justify-between pt-3 border-t border-blue-200">
                                            <span className="font-bold text-slate-900">Monthly Savings</span>
                                            <span className="font-mono font-bold text-emerald-600">$4,500</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="font-bold text-slate-900">Annual Savings</span>
                                            <span className="font-mono font-bold text-emerald-600">$54,000</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                                Everything you need to know about FloraIQ's logistics platform.
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
                    title="Ready to optimize your fleet?"
                    description="Join leading cannabis distributors who save 30% on fuel costs with FloraIQ. Start your 14-day free trial today."
                    primaryCta={{ text: "Start Optimizing Free", link: "/signup" }}
                />

                <MarketingFooter />
            </div>
        </ForceLightMode>
    );
}
