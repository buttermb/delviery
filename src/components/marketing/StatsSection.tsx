import { CountUpNumber } from "@/components/marketing/CountUpNumber";
import { ArrowRight } from "lucide-react";

const stats = [
    { label: "Active Nodes", value: 1248, suffix: "" },
    { label: "Tx Processed (24h)", value: 48932, suffix: "" },
    { label: "Cart Volume", value: 142.5, prefix: "$", suffix: "M" },
    { label: "API Uptime", value: 99.99, suffix: "%", decimals: 2 },
];

export function StatsSection() {
    return (
        <section className="py-20 bg-[hsl(var(--marketing-bg))] border-y border-[hsl(var(--marketing-border))]">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <p className="text-xs font-mono text-[hsl(var(--marketing-primary))] uppercase tracking-widest mb-2">// System_Status</p>
                    <h2 className="text-xl font-mono font-bold text-[hsl(var(--marketing-text))]">Production Metrics (Live)</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-12">
                    {stats.map((stat, index) => (
                        <div key={index} className="p-6 rounded border border-[hsl(var(--marketing-border))] bg-slate-50/50 hover:bg-slate-50 transition-colors">
                            <div className="text-3xl md:text-4xl font-mono font-bold text-[hsl(var(--marketing-primary))] mb-2 tracking-tighter">
                                <CountUpNumber
                                    end={stat.value}
                                    prefix={stat.prefix}
                                    suffix={stat.suffix}
                                    decimals={stat.decimals || 0}
                                />
                            </div>
                            <div className="text-xs font-mono text-[hsl(var(--marketing-text-light))] uppercase tracking-widest">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="text-center">
                    <a href="/case-studies" className="inline-flex items-center text-xs font-mono text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-primary))] transition-colors border-b border-transparent hover:border-[hsl(var(--marketing-primary))]">
                        view_case_studies.md <ArrowRight className="w-3 h-3 ml-2 inline-block" aria-hidden="true" />
                    </a>
                </div>
            </div>
        </section>
    );
}
