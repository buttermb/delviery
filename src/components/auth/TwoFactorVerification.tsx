import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

interface TwoFactorVerificationProps {
    onVerified: () => void;
    onCancel?: () => void;
}

export function TwoFactorVerification({ onVerified, onCancel }: TwoFactorVerificationProps) {
    const [loading, setLoading] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");
    const [factors, setFactors] = useState<any[]>([]);
    const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null);

    useEffect(() => {
        loadFactors();
    }, []);

    const loadFactors = async () => {
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;

            const verifiedFactors = data.totp.filter(f => f.status === 'verified');
            setFactors(verifiedFactors);
            if (verifiedFactors.length > 0) {
                setSelectedFactorId(verifiedFactors[0].id);
            }
        } catch (error) {
            console.error("Error loading MFA factors:", error);
            toast.error("Failed to load authentication factors");
        }
    };

    const verifyCode = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!selectedFactorId || !verificationCode) return;

        setLoading(true);
        try {
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: selectedFactorId,
            });

            if (challengeError) throw challengeError;

            const { data, error: verifyError } = await supabase.auth.mfa.verify({
                factorId: selectedFactorId,
                challengeId: challengeData.id,
                code: verificationCode,
            });

            if (verifyError) throw verifyError;

            toast.success("Authentication successful");
            onVerified();
        } catch (error: any) {
            console.error("MFA verification error:", error);
            toast.error(error.message || "Invalid code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (factors.length === 0) {
        return (
            <div className="text-center p-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading security options...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-sm mx-auto w-full">
            <div className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <ShieldCheck className="h-8 w-8 text-primary" />
                    </div>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">Two-Factor Authentication</h2>
                <p className="text-sm text-muted-foreground">
                    Enter the 6-digit code from your authenticator app to continue.
                </p>
            </div>

            <form onSubmit={verifyCode} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="code" className="sr-only">Verification Code</Label>
                    <Input
                        id="code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="font-mono tracking-widest text-center text-2xl h-14"
                        maxLength={6}
                        autoFocus
                        autoComplete="one-time-code"
                    />
                </div>

                <div className="space-y-2">
                    <Button
                        type="submit"
                        className="w-full h-10"
                        disabled={loading || verificationCode.length !== 6}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Verify
                    </Button>

                    {onCancel && (
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            onClick={onCancel}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
}
