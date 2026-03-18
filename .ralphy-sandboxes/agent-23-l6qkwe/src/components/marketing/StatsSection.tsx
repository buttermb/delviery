import { CountUpNumber } from "@/components/marketing/CountUpNumber";
import { ArrowRight } from "lucide-react";

const stats = [
    { label: "Active Dispensaries", value: 1200, suffix: "+" },
    { label: "Orders Processed", value: 50000, suffix: "+" },
    { label: "Revenue Generated", value: 150, prefix: "$", suffix: "M+" },
    { label: "Uptime Guarantee", value: 99.9, suffix: "%", decimals: 1 },
];

export function StatsSection() {
    return (
        <div className="container mx-auto px-4">
            <h2 className="text-center text-xl font-semibold mb-12 text-slate-500 uppercase tracking-widest">Trusted Scale & Reliability</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-12">
                {stats.map((stat, index) => (
                    <div key={index} className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1">
                        <div className="text-4xl md:text-5xl font-bold text-emerald-600 mb-2">
                            <CountUpNumber
                                end={stat.value}
                                prefix={stat.prefix}
                                suffix={stat.suffix}
                                decimals={stat.decimals}
                            />
                        </div>
                        <div className="text-slate-600 font-medium text-lg">
                            {stat.label}
                        </div>
                    </div>
                ))}
            </div>
            <div className="text-center">
                <a href="/case-studies" className="inline-flex items-center text-emerald-600 hover:text-emerald-700 font-semibold transition-colors text-lg">
                    See Our Case Studies <ArrowRight className="w-5 h-5 ml-2 inline-block" aria-hidden="true" />
                </a>
            </div>
        </div>
    );
}
