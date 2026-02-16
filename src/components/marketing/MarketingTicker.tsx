import { Flame, Shield, Smartphone, Lock, EyeOff, Zap } from "lucide-react";

const tickerItems = [
    { text: "SECURE DISPOSABLE MENUS", icon: Shield },
    { text: "INSTANT BURN ON SCREENSHOT", icon: Flame },
    { text: "DEVICE FINGERPRINTING", icon: Smartphone },
    { text: "AES-256 ENCRYPTION", icon: Lock },
    { text: "ANONYMOUS VIEWING", icon: EyeOff },
    { text: "NO APP REQUIRED", icon: Zap },
];

export function MarketingTicker() {
    // Duplicate items to ensure smooth infinite scroll
    const items = [...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems];

    return (
        <div className="w-full bg-[hsl(var(--marketing-primary))] border-y-2 border-[hsl(var(--marketing-primary))] overflow-hidden py-4 overflow-x-hidden relative flex selection:bg-transparent">

            {/* CSS-only infinite scroll animation container */}
            <div
                className="flex gap-16 whitespace-nowrap will-change-transform w-max animate-marquee"
                style={{
                    animation: 'marquee 40s linear infinite',
                }}
            >
                {items.map((item, i) => {
                    const Icon = item.icon;
                    return (
                        <div key={i} className="flex items-center gap-4">
                            <Icon className="w-6 h-6 text-white/50" />
                            <span className="font-extrabold text-xl tracking-widest text-white uppercase">{item.text}</span>
                        </div>
                    );
                })}
            </div>

            {/* CSS keyframes for marquee */}
            <style>{`
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-marquee {
            width: max-content;
        }
      `}</style>
        </div>
    );
}
