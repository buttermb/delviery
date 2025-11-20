import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

export function StickyMobileCTA() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Show after scrolling past hero (approx 600px)
            const show = window.scrollY > 600;
            setIsVisible(show);
        };

        window.addEventListener("scroll", handleScroll);
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
                    className="fixed bottom-4 left-4 right-4 z-50 md:hidden"
                >
                    <div className="bg-[hsl(var(--marketing-bg-subtle))] border border-[hsl(var(--marketing-border))] p-3 rounded-2xl shadow-lg flex items-center justify-between gap-3 backdrop-blur-xl bg-opacity-90">
                        <div className="flex flex-col">
                            <span className="text-xs font-medium text-[hsl(var(--marketing-text-light))]">
                                Ready to scale?
                            </span>
                            <span className="text-sm font-bold text-[hsl(var(--marketing-text))]">
                                Start your 14-day trial
                            </span>
                        </div>
                        <Link to="/signup">
                            <Button
                                size="sm"
                                className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-secondary))] text-white rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                            >
                                Get Started
                                <ArrowRight className="ml-1.5 h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
