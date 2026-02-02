import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { useState, useEffect } from "react";

export function StickyMobileCTA() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Show earlier - after scrolling past 10% of viewport (approx 200px)
            const show = window.scrollY > 200;
            setIsVisible(show);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom"
                >
                    <div className="bg-[hsl(var(--marketing-bg))]/95 border-t border-[hsl(var(--marketing-border))] px-4 py-3 backdrop-blur-xl">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-accent))] flex items-center justify-center flex-shrink-0">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-medium text-[hsl(var(--marketing-text-light))]">
                                        Limited Time Offer
                                    </span>
                                    <span className="text-sm font-bold text-[hsl(var(--marketing-text))] truncate">
                                        14-day free trial • No credit card
                                    </span>
                                </div>
                            </div>
                            <Link to="/signup" className="flex-shrink-0">
                                <Button
                                    size="lg"
                                    className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-secondary))] text-white rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] min-h-[56px] px-6 touch-manipulation active:scale-95 transition-transform"
                                >
                                    Start Free
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
