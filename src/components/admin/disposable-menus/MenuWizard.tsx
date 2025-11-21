
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, ArrowRight, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MenuWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function MenuWizard({ open, onOpenChange }: MenuWizardProps) {
    const [step, setStep] = useState(1);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        setIsGenerating(true);
        // Simulate AI generation
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsGenerating(false);
        setStep(2);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        AI Menu Creator
                    </DialogTitle>
                </DialogHeader>

                <div className="py-6">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <div className="text-center space-y-2 mb-8">
                                    <h3 className="text-lg font-semibold">Describe your menu</h3>
                                    <p className="text-muted-foreground">
                                        Tell us what you want to create, and we'll configure everything for you.
                                    </p>
                                </div>

                                <Textarea
                                    placeholder="e.g., Create a secure menu for a VIP event this Friday. Include my top 5 cocktails and set it to expire in 24 hours."
                                    className="min-h-[120px] text-lg p-4 resize-none"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />

                                <div className="flex justify-end pt-4">
                                    <Button
                                        size="lg"
                                        className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                                        onClick={handleGenerate}
                                        disabled={!prompt || isGenerating}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Analyzing...
                                            </>
                                        ) : (
                                            <>
                                                Generate Menu
                                                <Sparkles className="ml-2 h-4 w-4" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
                                    <div className="bg-green-500 rounded-full p-1">
                                        <Check className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-green-500">Menu Configured!</h4>
                                        <p className="text-sm text-muted-foreground">Based on your request, we've set up the following:</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-lg border bg-muted/50">
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Security</span>
                                        <p className="font-medium mt-1">High (VIP Mode)</p>
                                    </div>
                                    <div className="p-4 rounded-lg border bg-muted/50">
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Expiration</span>
                                        <p className="font-medium mt-1">24 Hours</p>
                                    </div>
                                    <div className="p-4 rounded-lg border bg-muted/50">
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Products</span>
                                        <p className="font-medium mt-1">5 Items Selected</p>
                                    </div>
                                    <div className="p-4 rounded-lg border bg-muted/50">
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider">Access</span>
                                        <p className="font-medium mt-1">Password Protected</p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                                    <Button
                                        size="lg"
                                        onClick={() => onOpenChange(false)}
                                    >
                                        Create Menu
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
}
