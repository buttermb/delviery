import { logger } from '@/lib/logger';
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, KeyRound, Smartphone } from "lucide-react";

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
    const [error, setError] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

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
        if (e) e.preventDefault();
        setError(null);

        if (isRecoveryMode) {
            await verifyRecoveryCode();
            return;
        }
        if (!selectedFactorId || !verificationCode || verificationCode.length !== 6) return;

        setLoading(true);
        try {
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: selectedFactorId,
            });

            if (challengeError) throw challengeError;

            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: selectedFactorId,
                challengeId: challengeData.id,
                code: verificationCode,
            });

            if (verifyError) throw verifyError;

            toast.success("Authentication successful");
            onVerified();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Verification failed';
            setError(errorMessage.includes('Invalid') || errorMessage.includes('invalid')
                ? 'Invalid code. Please check and try again.'
                : errorMessage);
            setVerificationCode("");
            handleError(err, { component: 'TwoFactorVerification', toastTitle: 'Verification failed' });
        } finally {
            setLoading(false);
        }
    };

    // Auto-submit when 6 digits are entered
    const handleOTPComplete = (value: string) => {
        setVerificationCode(value);
        if (value.length === 6 && !isRecoveryMode && selectedFactorId) {
            // Delay submission slightly to allow state to update
            setTimeout(() => {
                formRef.current?.requestSubmit();
            }, 100);
        }
    };

    const verifyRecoveryCode = async () => {
        if (!backupCode) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: invokeError } = await supabase.functions.invoke('verify-backup-code', {
                body: { code: backupCode }
            });

            if (invokeError) throw invokeError;
            if (data.error) throw new Error(data.error);

            toast.success("Recovery successful. MFA has been disabled.");

            // Refresh session to reflect MFA removal
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) logger.warn("Session refresh after recovery failed", refreshError);

            onVerified();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Recovery failed';
            setError(errorMessage.includes('Invalid') || errorMessage.includes('invalid')
                ? 'Invalid recovery code. Please check and try again.'
                : errorMessage);
            setBackupCode("");
            handleError(err, { component: 'TwoFactorVerification', toastTitle: 'Recovery failed' });
        } finally {
            setLoading(false);
        }
    };

    if (factors.length === 0) {
        return (
            <div className="text-center p-6">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                <p className="text-sm text-muted-foreground">Loading security options...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-sm mx-auto w-full">
            {/* Header */}
            <div className="text-center space-y-3">
                <div className="flex justify-center">
                    <div className="p-3 bg-primary/10 rounded-full">
                        {isRecoveryMode ? (
                            <KeyRound className="h-8 w-8 text-primary" />
                        ) : (
                            <Smartphone className="h-8 w-8 text-primary" />
                        )}
                    </div>
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                    {isRecoveryMode ? "Account Recovery" : "Enter Verification Code"}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {isRecoveryMode
                        ? "Enter one of your 10-character backup codes to regain access to your account."
                        : "Enter the 6-digit code from your authenticator app to continue."}
                </p>
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3 text-center animate-in fade-in-0 slide-in-from-top-1">
                    {error}
                </div>
            )}

            <form ref={formRef} onSubmit={verifyCode} className="space-y-6">
                <div className="space-y-3">
                    <Label htmlFor="code" className="sr-only">
                        {isRecoveryMode ? "Backup Code" : "Verification Code"}
                    </Label>

                    {isRecoveryMode ? (
                        <Input
                            id="backupCode"
                            value={backupCode}
                            onChange={(e) => {
                                setBackupCode(e.target.value.trim());
                                setError(null);
                            }}
                            placeholder="XXXX-XXXX-XX"
                            className="font-mono text-center text-lg h-14 tracking-wider"
                            autoFocus
                            disabled={loading}
                        />
                    ) : (
                        <div className="flex justify-center">
                            <InputOTP
                                maxLength={6}
                                value={verificationCode}
                                onChange={(value) => {
                                    setVerificationCode(value);
                                    setError(null);
                                }}
                                onComplete={handleOTPComplete}
                                disabled={loading}
                                autoFocus
                            >
                                <InputOTPGroup>
                                    <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                                    <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                                    <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                                </InputOTPGroup>
                                <InputOTPSeparator />
                                <InputOTPGroup>
                                    <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
                                    <InputOTPSlot index={4} className="h-12 w-12 text-lg" />
                                    <InputOTPSlot index={5} className="h-12 w-12 text-lg" />
                                </InputOTPGroup>
                            </InputOTP>
                        </div>
                    )}

                    {!isRecoveryMode && (
                        <p className="text-xs text-muted-foreground text-center">
                            Code refreshes every 30 seconds
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    <Button
                        type="submit"
                        className="w-full h-11"
                        disabled={loading || (isRecoveryMode ? !backupCode : verificationCode.length !== 6)}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Verifying...
                            </>
                        ) : (
                            isRecoveryMode ? "Verify Recovery Code" : "Verify & Continue"
                        )}
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-muted" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">or</span>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                            setIsRecoveryMode(!isRecoveryMode);
                            setVerificationCode("");
                            setBackupCode("");
                            setError(null);
                        }}
                        disabled={loading}
                    >
                        {isRecoveryMode ? (
                            <>
                                <Smartphone className="mr-2 h-4 w-4" />
                                Use Authenticator App
                            </>
                        ) : (
                            <>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Use Recovery Code
                            </>
                        )}
                    </Button>

                    {onCancel && (
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={onCancel}
                            disabled={loading}
                        >
                            Cancel and Sign Out
                        </Button>
                    )}
                </div>
            </form>
        </div>
    );
}
