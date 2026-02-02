import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Package from "lucide-react/dist/esm/icons/package";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Truck from "lucide-react/dist/esm/icons/truck";
import { Link } from 'react-router-dom';
import { logger } from '@/lib/logger';

export function FreeVsTrialExplainer() {
    const [orderVolume, setOrderVolume] = useState<string | null>(null);
    const [recommendation, setRecommendation] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const getRecommendation = async (volume: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('pricing-advisor', {
                body: { orderVolume: volume }
            });

            if (error) throw error;
            setRecommendation(data.recommendation);
        } catch (error) {
            logger.error('AI Recommendation failed', error);
            // Fallback
            if (volume === 'light') setRecommendation("We recommend starting with the FREE TIER. It's perfect for 1-5 orders/day and requires no credit card.");
            else if (volume === 'medium') setRecommendation("The STARTER plan is your best bet. You'll need unlimited orders for your volume. Start with the 14-day trial.");
            else setRecommendation("For high volume, go PROFESSIONAL. You need advanced automation features. Try it free for 14 days.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (volume: string) => {
        setOrderVolume(volume);
        getRecommendation(volume);
    };

    return (
        <div className="w-full max-w-4xl mx-auto my-12 p-6 bg-gradient-to-br from-[hsl(var(--marketing-bg-subtle))] to-[hsl(var(--marketing-bg))] rounded-3xl border border-[hsl(var(--marketing-border))] shadow-lg">
            <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">Which Plan is Right for You?</h3>
                <p className="text-[hsl(var(--marketing-text-light))]">Answer one question and our AI will recommend the best fit.</p>
            </div>

            {!recommendation ? (
                <div className="grid md:grid-cols-3 gap-4">
                    <button
                        onClick={() => handleSelect('light')}
                        className={`p-6 rounded-xl border-2 transition-all hover:border-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/5 text-left group ${loading && orderVolume === 'light' ? 'border-[hsl(var(--marketing-primary))] bg-[hsl(var(--marketing-primary))]/5' : 'border-[hsl(var(--marketing-border))] bg-background'}`}
                        disabled={loading}
                    >
                        <div className="mb-4 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Package className="h-6 w-6" />
                        </div>
                        <h4 className="font-bold mb-1">Just Starting</h4>
                        <p className="text-sm text-[hsl(var(--marketing-text-light))]">1-5 orders/day</p>
                    </button>

                    <button
                        onClick={() => handleSelect('medium')}
                        className={`p-6 rounded-xl border-2 transition-all hover:border-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/5 text-left group ${loading && orderVolume === 'medium' ? 'border-[hsl(var(--marketing-primary))] bg-[hsl(var(--marketing-primary))]/5' : 'border-[hsl(var(--marketing-border))] bg-background'}`}
                        disabled={loading}
                    >
                        <div className="mb-4 w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <h4 className="font-bold mb-1">Growing</h4>
                        <p className="text-sm text-[hsl(var(--marketing-text-light))]">5-20 orders/day</p>
                    </button>

                    <button
                        onClick={() => handleSelect('high')}
                        className={`p-6 rounded-xl border-2 transition-all hover:border-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/5 text-left group ${loading && orderVolume === 'high' ? 'border-[hsl(var(--marketing-primary))] bg-[hsl(var(--marketing-primary))]/5' : 'border-[hsl(var(--marketing-border))] bg-background'}`}
                        disabled={loading}
                    >
                        <div className="mb-4 w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                            <Truck className="h-6 w-6" />
                        </div>
                        <h4 className="font-bold mb-1">High Volume</h4>
                        <p className="text-sm text-[hsl(var(--marketing-text-light))]">20+ orders/day</p>
                    </button>
                </div>
            ) : (
                <div className="animate-in fade-in zoom-in duration-300">
                    <Card className="bg-background border-[hsl(var(--marketing-primary))] border-2 p-6 md:p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Package className="w-32 h-32 text-[hsl(var(--marketing-primary))]" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-2xl">🤖</span>
                                <h4 className="text-xl font-bold text-[hsl(var(--marketing-primary))]">Our Recommendation</h4>
                            </div>
                            <p className="text-lg mb-6 max-w-2xl">{recommendation}</p>

                            <div className="flex gap-4">
                                <Link to="/signup?plan=free">
                                    <Button size="lg" className="bg-[hsl(var(--marketing-primary))] hover:bg-[hsl(var(--marketing-primary))]/90 text-white">
                                        Start Free
                                    </Button>
                                </Link>
                                <Link to="/signup?plan=starter">
                                    <Button size="lg" variant="outline">
                                        Start Trial
                                    </Button>
                                </Link>
                                <button onClick={() => { setRecommendation(null); setOrderVolume(null); }} className="text-sm text-[hsl(var(--marketing-text-light))] hover:underline px-4">
                                    Start Over
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
            {loading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-3xl z-50">
                    <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--marketing-primary))]" />
                </div>
            )}
        </div>
    );
}
