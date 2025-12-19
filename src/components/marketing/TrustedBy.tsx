import { motion } from "framer-motion";

const DISTRIBUTORS = [
    "GreenLeaf Distribution",
    "CannaLogistics",
    "HighTide Wholesale",
    "Verde Valley",
    "Apex Cannabis",
    "Pacific Roots",
    "Emerald City Distro",
    "Urban Harvest",
    "Nature's Gift",
    "Elevated Supply",
    // Duplicate for seamless loop
    "GreenLeaf Distribution",
    "CannaLogistics",
    "HighTide Wholesale",
    "Verde Valley",
    "Apex Cannabis",
];

export function TrustedBy() {
    return (
        <section className="py-10 border-y border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-bg-subtle))/0.3] overflow-hidden">
            <div className="container mx-auto px-4 text-center mb-8">
                <p className="text-sm font-medium text-[hsl(var(--marketing-text-light))] uppercase tracking-wider">
                    Trusted by <span className="text-[hsl(var(--marketing-primary))] font-bold">500+</span> Cannabis Distributors
                </p>
            </div>

            <div className="relative flex">
                <motion.div
                    className="flex whitespace-nowrap"
                    animate={{ x: [0, -1000] }}
                    transition={{
                        repeat: Infinity,
                        ease: "linear",
                        duration: 30
                    }}
                >
                    {DISTRIBUTORS.map((name, i) => (
                        <div key={i} className="mx-8 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity cursor-default">
                            <span className="text-xl font-bold text-[hsl(var(--marketing-text))]">{name}</span>
                        </div>
                    ))}
                    {DISTRIBUTORS.map((name, i) => (
                        <div key={`dup-${i}`} className="mx-8 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity cursor-default">
                            <span className="text-xl font-bold text-[hsl(var(--marketing-text))]">{name}</span>
                        </div>
                    ))}
                </motion.div>

                {/* Fade edges */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[hsl(var(--marketing-bg))] to-transparent z-10" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[hsl(var(--marketing-bg))] to-transparent z-10" />
            </div>
        </section>
    );
}
