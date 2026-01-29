import { logger } from '@/lib/logger';
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

import { handleError } from '@/utils/errorHandling/handlers';

export function TwoFactorVerification({ onVerified, onCancel }: TwoFactorVerificationProps) {
    const [loading, setLoading] = useState(false);
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);
    const [backupCode, setBackupCode] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null);
    const [factors, setFactors] = useState<Array<{ id: string; factor_type: string }>>([]);

    // Load MFA factors on mount
    useEffect(() => {
        const loadFactors = async () => {
            try {
                const { data, error } = await supabase.auth.mfa.listFactors();
                if (error) throw error;
                const totpFactors = data?.totp || [];
                setFactors(totpFactors);
                if (totpFactors.length > 0) {
                    setSelectedFactorId(totpFactors[0].id);
                }
            } catch (error) {
                logger.error('Failed to load MFA factors', error as Error);
            }
        };
        loadFactors();
    }, []);

    const verifyCode = async (e?: React.FormEvent) => {
        // ... (existing TOTP verification)
        if (e) e.preventDefault();
        if (isRecoveryMode) {
            await verifyRecoveryCode();
            return;
        }
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
        } catch (error) {
            handleError(error, { component: 'TwoFactorVerification', toastTitle: 'Verification failed' });
        } finally {
            setLoading(false);
        }
    };

    const verifyRecoveryCode = async () => {
        if (!backupCode) return;
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('verify-backup-code', {
                body: { code: backupCode }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            toast.success("Recovery successful. MFA has been disabled.");

            // Refresh session to reflect MFA removal
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) logger.warn("Session refresh after recovery failed", refreshError);

            onVerified();
        } catch (error) {
            handleError(error, { component: 'TwoFactorVerification', toastTitle: 'Recovery failed' });
        } finally {
            setLoading(false);
        }
    };

    if (factors.length === 0) {
        // ... (loading view)
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
                <h2 className="text-2xl font-semibold tracking-tight">
                    {isRecoveryMode ? "Account Recovery" : "Two-Factor Authentication"}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {isRecoveryMode
                        ? "Enter one of your 10-character backup codes."
                        : "Enter the 6-digit code from your authenticator app."}
                </p>
            </div>

            <form onSubmit={verifyCode} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="code" className="sr-only">
                        {isRecoveryMode ? "Backup Code" : "Verification Code"}
                    </Label>

                    {isRecoveryMode ? (
                        <Input
                            id="backupCode"
                            value={backupCode}
                            onChange={(e) => setBackupCode(e.target.value.trim())}
                            placeholder="Enter backup code"
                            className="font-mono text-center text-lg h-14"
                            autoFocus
                        />
                    ) : (
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
                    )}
                </div>

                <div className="space-y-3">
                    <Button
                        type="submit"
                        className="w-full h-10"
                        disabled={loading || (isRecoveryMode ? !backupCode : verificationCode.length !== 6)}
                        aria-busy={loading}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading
                            ? 'Verifying...'
                            : isRecoveryMode
                                ? "Verify Recovery Code"
                                : "Verify"}
                    </Button>

                    <div className="text-center">
                        <Button
                            type="button"
                            variant="link"
                            className="text-sm text-muted-foreground"
                            disabled={loading}
                            onClick={() => {
                                setIsRecoveryMode(!isRecoveryMode);
                                setVerificationCode("");
                                setBackupCode("");
                            }}
                        >
                            {isRecoveryMode
                                ? "Use Authenticator App instead"
                                : "Lost your device? Use a backup code"}
                        </Button>
                    </div>

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
