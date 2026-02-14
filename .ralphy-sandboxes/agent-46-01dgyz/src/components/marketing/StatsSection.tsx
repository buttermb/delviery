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
        <section className="py-20 bg-[hsl(var(--marketing-bg))] border-y border-[hsl(var(--marketing-border))]">
            <div className="container mx-auto px-4">
                <h2 className="text-center text-xl font-semibold mb-12 text-[hsl(var(--marketing-text))]">Trusted Scale & Reliability</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-12">
                    {stats.map((stat, index) => (
                        <div key={index} className="p-6 rounded-2xl bg-[hsl(var(--marketing-bg-subtle))]/20 hover:bg-[hsl(var(--marketing-bg-subtle))]/40 transition-colors">
                            <div className="text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-primary))] mb-2">
                                <CountUpNumber
                                    end={stat.value}
                                    prefix={stat.prefix}
                                    suffix={stat.suffix}
                                    decimals={stat.decimals}
                                />
                            </div>
                            <div className="text-[hsl(var(--marketing-text-light))] font-medium">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="text-center">
                    <a href="/case-studies" className="inline-flex items-center text-[hsl(var(--marketing-primary))] hover:text-[hsl(var(--marketing-primary))/80] font-medium transition-colors">
                        See Our Case Studies <ArrowRight className="w-4 h-4 ml-2 inline-block" aria-hidden="true" />
                    </a>
                </div>
            </div>
        </section>
    );
}
