import { logger } from '@/lib/logger';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { handleError } from '@/utils/errorHandling/handlers';

export function TwoFactorSetup() {
    const [loading, setLoading] = useState(false);
    const [factorId, setFactorId] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState("");
    const [isEnabled, setIsEnabled] = useState(false);
    const [factors, setFactors] = useState<any[]>([]);
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [showBackupCodes, setShowBackupCodes] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;

            const totpFactor = data.totp.find((f) => f.status === 'verified');
            if (totpFactor) {
                setIsEnabled(true);
                setFactors(data.totp);
            }
        } catch (error) {
            logger.error("Error checking MFA status:", error);
        }
    };

    const startSetup = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
            });

            if (error) throw error;

            setFactorId(data.id);
            setSecret(data.totp.secret);

            // Generate QR Code
            const qrUrl = await QRCode.toDataURL(data.totp.uri);
            setQrCodeUrl(qrUrl);
        } catch (error) {
            handleError(error, { component: 'TwoFactorSetup', toastTitle: 'Error starting setup' });
        } finally {
            setLoading(false);
        }
    };

    const generateBackupCodes = async () => {
        const codes = Array.from({ length: 10 }, () =>
            Array.from(crypto.getRandomValues(new Uint8Array(5)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
        );
        return codes;
    };

    const hashBackupCode = async (code: string) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(code);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const saveBackupCodes = async (codes: string[]) => {
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) throw new Error("No user found");

            // Hash all codes
            const hashedCodes = await Promise.all(codes.map(hashBackupCode));

            // Insert into DB
            const { error } = await (supabase as any)
                .from('user_backup_codes') // Ensure table exists/accessible
                .insert(
                    hashedCodes.map(hash => ({
                        user_id: user.id,
                        code_hash: hash
                    }))
                );

            if (error) throw error;
            return true;
        } catch (error) {
            logger.error("Failed to save backup codes", error);
            // Don't block flow, but warn
            toast({
                title: "Warning",
                description: "Failed to save backup codes. Please try regenerating them later.",
                variant: "destructive"
            });
            return false;
        }
    };

    const verifyAndEnable = async () => {
        if (!factorId || !verificationCode) return;
        setLoading(true);

        try {
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId,
            });

            if (challengeError) throw challengeError;

            const { data, error: verifyError } = await supabase.auth.mfa.verify({
                factorId,
                challengeId: challengeData.id,
                code: verificationCode,
            });

            if (verifyError) throw verifyError;

            // Generate and save backup codes
            const codes = await generateBackupCodes();
            const saved = await saveBackupCodes(codes);

            if (saved) {
                setBackupCodes(codes);
                setShowBackupCodes(true);
            }

            setIsEnabled(true);
            setQrCodeUrl(null);
            setSecret(null);
            setFactorId(null);
            toast({
                title: "2FA Enabled",
                description: "Two-factor authentication has been successfully enabled.",
            });
            checkStatus();
        } catch (error) {
            handleError(error, { component: 'TwoFactorSetup', toastTitle: 'Verification failed' });
        } finally {
            setLoading(false);
        }
    };

    const downloadBackupCodes = () => {
        const content = `FloraIQ Backup Codes\n\nGenerated on: ${new Date().toLocaleString()}\n\n` +
            `Keep these codes safe. Each code can be used once to recover access to your account.\n\n` +
            backupCodes.join('\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'floraiq-backup-codes.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Render Backup Codes Dialog/View
    if (showBackupCodes) {
        return (
            <div className="space-y-6 border p-6 rounded-lg bg-background">
                <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-6 w-6" />
                    <h3 className="text-lg font-bold">Save Your Backup Codes</h3>
                </div>

                <p className="text-muted-foreground">
                    If you lose access to your authenticator app, these codes are the <strong>only way</strong> to recover your account.
                    Store them in a safe place.
                </p>

                <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg border font-mono text-center">
                    {backupCodes.map((code, i) => (
                        <div key={i} className="p-2 bg-background rounded border text-sm select-all">
                            {code}
                        </div>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={downloadBackupCodes} className="flex-1">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Download Codes
                    </Button>
                    <Button variant="outline" onClick={() => setShowBackupCodes(false)} className="flex-1">
                        I have saved them
                    </Button>
                </div>
            </div>
        );
    }

    const disable2FA = async () => {
        if (!confirm("Are you sure you want to disable 2FA? This will lower your account security.")) return;

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;

            const totpFactor = data.totp.find((f) => f.status === 'verified');
            if (!totpFactor) return;

            const { error: unenrollError } = await supabase.auth.mfa.unenroll({
                factorId: totpFactor.id,
            });

            if (unenrollError) throw unenrollError;

            setIsEnabled(false);
            setFactors([]);
            toast({
                title: "2FA Disabled",
                description: "Two-factor authentication has been disabled.",
            });
        } catch (error) {
            handleError(error, { component: 'TwoFactorSetup', toastTitle: 'Error disabling 2FA' });
        } finally {
            setLoading(false);
        }
    };

    if (isEnabled) {
        return (
            <div className="space-y-4">
                <Alert className="bg-green-50 border-green-200">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">2FA is Enabled</AlertTitle>
                    <AlertDescription className="text-green-700">
                        Your account is secured with two-factor authentication.
                    </AlertDescription>
                </Alert>

                <Button
                    variant="destructive"
                    onClick={disable2FA}
                    disabled={loading}
                    className="w-full sm:w-auto"
                >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Disable 2FA
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {!qrCodeUrl ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <ShieldCheck className="h-5 w-5" />
                        <p>Secure your account with two-factor authentication.</p>
                    </div>
                    <Button onClick={startSetup} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Setup 2FA
                    </Button>
                </div>
            ) : (
                <div className="space-y-6 border p-4 rounded-lg">
                    <div className="space-y-2">
                        <h3 className="font-semibold">1. Scan QR Code</h3>
                        <p className="text-sm text-muted-foreground">
                            Use an authenticator app like Google Authenticator or Authy to scan this QR code.
                        </p>
                        <div className="flex justify-center p-4 bg-white rounded-lg w-fit mx-auto">
                            <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                        </div>
                        {secret && (
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">Can't scan? Enter this code manually:</p>
                                <code className="bg-muted px-2 py-1 rounded text-sm font-mono select-all">{secret}</code>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-semibold">2. Enter Verification Code</h3>
                        <p className="text-sm text-muted-foreground">
                            Enter the 6-digit code from your authenticator app.
                        </p>
                        <div className="flex gap-2">
                            <Input
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                className="font-mono tracking-widest text-center text-lg max-w-[200px]"
                                maxLength={6}
                            />
                            <Button onClick={verifyAndEnable} disabled={loading || verificationCode.length !== 6}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Verify & Enable
                            </Button>
                        </div>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => {
                        setQrCodeUrl(null);
                        setSecret(null);
                        setFactorId(null);
                    }}>
                        Cancel Setup
                    </Button>
                </div>
            )}
        </div>
    );
}
