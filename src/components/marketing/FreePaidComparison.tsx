import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function FreePaidComparison() {
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY;
            // Show after scrolling past hero (approx 800px) and if not dismissed
            if (scrollY > 800 && !isDismissed) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isDismissed]);

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 right-4 z-40 animate-in slide-in-from-bottom-4 duration-300 w-full max-w-sm">
            <div className="bg-background border border-[hsl(var(--marketing-border))] shadow-2xl rounded-2xl p-4 relative overflow-hidden">
                <button
                    onClick={() => { setIsDismissed(true); setIsVisible(false); }}
                    className="absolute top-2 right-2 text-[hsl(var(--marketing-text-light))] hover:text-[hsl(var(--marketing-text))]"
                >
                    <X className="h-4 w-4" />
                </button>

                <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[hsl(var(--marketing-primary))] animate-pulse" />
                    Quick Compare
                </h4>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-3 bg-[hsl(var(--marketing-bg-subtle))] rounded-lg border border-[hsl(var(--marketing-border))]">
                        <div className="text-xs font-bold text-[hsl(var(--marketing-text))] mb-1">FREE</div>
                        <div className="text-lg font-bold text-[hsl(var(--marketing-primary))]">$0</div>
                        <div className="text-[10px] text-[hsl(var(--marketing-text-light))]">No CC required</div>
                    </div>
                    <div className="p-3 bg-[hsl(var(--marketing-bg))] rounded-lg border border-[hsl(var(--marketing-primary))/30 text-center">
                        <div className="text-xs font-bold text-[hsl(var(--marketing-text))] mb-1">STARTER</div>
                        <div className="text-lg font-bold text-[hsl(var(--marketing-text))]">$79</div>
                        <div className="text-[10px] text-[hsl(var(--marketing-text-light))]">14-day trial</div>
                    </div>
                </div>

                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs px-1">
                        <span className="text-[hsl(var(--marketing-text-light))]">Credits</span>
                        <span className="font-medium text-[hsl(var(--marketing-text))]">500 vs Unlimited</span>
                    </div>
                    <div className="flex justify-between text-xs px-1">
                        <span className="text-[hsl(var(--marketing-text-light))]">Locations</span>
                        <span className="font-medium text-[hsl(var(--marketing-text))]">1 vs 2</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Link to="/signup?plan=free">
                        <Button size="sm" variant="outline" className="w-full text-xs">
                            Start Free
                        </Button>
                    </Link>
                    <Link to="/pricing">
                        <Button size="sm" className="w-full text-xs bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
                            Compare All
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
