import { logger } from '@/lib/logger';
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { Loader2, ShieldCheck, AlertTriangle, Download, Copy } from "lucide-react";
import { handleError } from '@/utils/errorHandling/handlers';

interface MfaFactor {
    id: string;
    factor_type: string;
    status: string;
    friendly_name?: string;
}

type SetupStep = 'idle' | 'password-confirm' | 'qr-code' | 'backup-codes';
type ActionIntent = 'enable' | 'disable';

export function TwoFactorSetup() {
    const [loading, setLoading] = useState(false);
    const [factorId, setFactorId] = useState<string | null>(null);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [verificationCode, setVerificationCode] = useState("");
    const [isEnabled, setIsEnabled] = useState(false);
    const [_factors, setFactors] = useState<MfaFactor[]>([]);
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [setupStep, setSetupStep] = useState<SetupStep>('idle');
    const [actionIntent, setActionIntent] = useState<ActionIntent>('enable');
    const [password, setPassword] = useState("");
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [confirmingPassword, setConfirmingPassword] = useState(false);
    const [showDisableDialog, setShowDisableDialog] = useState(false);

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
                setFactors(data.totp as MfaFactor[]);
            }
        } catch (err) {
            logger.error("Error checking MFA status:", err);
        }
    };

    const confirmPassword = useCallback(async (): Promise<boolean> => {
        setPasswordError(null);
        setConfirmingPassword(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) {
                setPasswordError("Unable to verify identity. No email found.");
                return false;
            }

            const { error } = await supabase.auth.signInWithPassword({
                email: user.email,
                password,
            });

            if (error) {
                setPasswordError("Incorrect password. Please try again.");
                return false;
            }

            return true;
        } catch {
            setPasswordError("Failed to verify password. Please try again.");
            return false;
        } finally {
            setConfirmingPassword(false);
        }
    }, [password]);

    const handlePasswordConfirmSubmit = async () => {
        const valid = await confirmPassword();
        if (!valid) return;

        setPassword("");
        setPasswordError(null);

        if (actionIntent === 'enable') {
            setSetupStep('qr-code');
            await startSetup();
        } else {
            await performDisable();
        }
    };

    const initiateEnable = () => {
        setActionIntent('enable');
        setSetupStep('password-confirm');
        setPassword("");
        setPasswordError(null);
    };

    const initiateDisable = () => {
        setActionIntent('disable');
        setShowDisableDialog(true);
    };

    const handleDisableConfirm = () => {
        setShowDisableDialog(false);
        setSetupStep('password-confirm');
        setPassword("");
        setPasswordError(null);
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

            const qrUrl = await QRCode.toDataURL(data.totp.uri);
            setQrCodeUrl(qrUrl);
        } catch (error) {
            handleError(error, { component: 'TwoFactorSetup', toastTitle: 'Error starting setup' });
            setSetupStep('idle');
        } finally {
            setLoading(false);
        }
    };

    const generateBackupCodes = (): string[] => {
        return Array.from({ length: 10 }, () =>
            Array.from(crypto.getRandomValues(new Uint8Array(5)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
        );
    };

    const hashBackupCode = async (code: string): Promise<string> => {
        const encoder = new TextEncoder();
        const data = encoder.encode(code);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const saveBackupCodes = async (codes: string[]): Promise<boolean> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            const hashedCodes = await Promise.all(codes.map(hashBackupCode));

            const { error } = await supabase
                .from('user_backup_codes')
                .insert(
                    hashedCodes.map(hash => ({
                        user_id: user.id,
                        code_hash: hash,
                    }))
                );

            if (error) throw error;
            return true;
        } catch (error) {
            logger.error("Failed to save backup codes", error);
            toast({
                title: "Warning",
                description: "Failed to save backup codes. Please try regenerating them later.",
                variant: "destructive",
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

            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId,
                challengeId: challengeData.id,
                code: verificationCode,
            });

            if (verifyError) throw verifyError;

            const codes = generateBackupCodes();
            const saved = await saveBackupCodes(codes);

            if (saved) {
                setBackupCodes(codes);
                setSetupStep('backup-codes');
            }

            setIsEnabled(true);
            setQrCodeUrl(null);
            setSecret(null);
            setFactorId(null);
            setVerificationCode("");
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

    const performDisable = async () => {
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
            setSetupStep('idle');
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

    const copyBackupCodes = async () => {
        try {
            await navigator.clipboard.writeText(backupCodes.join('\n'));
            toast({ title: "Copied", description: "Backup codes copied to clipboard." });
        } catch {
            toast({ title: "Failed", description: "Could not copy to clipboard.", variant: "destructive" });
        }
    };

    const cancelSetup = () => {
        setQrCodeUrl(null);
        setSecret(null);
        setFactorId(null);
        setVerificationCode("");
        setSetupStep('idle');
        setPassword("");
        setPasswordError(null);
    };

    // Password confirmation dialog
    if (setupStep === 'password-confirm') {
        return (
            <div className="space-y-6 border p-6 rounded-lg bg-background">
                <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Confirm Your Password</h3>
                    <p className="text-sm text-muted-foreground">
                        {actionIntent === 'enable'
                            ? "Enter your password to begin two-factor authentication setup."
                            : "Enter your password to disable two-factor authentication."}
                    </p>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handlePasswordConfirmSubmit();
                    }}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Label htmlFor="password-confirm">Password</Label>
                        <PasswordInput
                            id="password-confirm"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setPasswordError(null);
                            }}
                            placeholder="Enter your password"
                            autoFocus
                            autoComplete="current-password"
                        />
                        {passwordError && (
                            <p className="text-sm text-destructive">{passwordError}</p>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <Button
                            type="submit"
                            disabled={!password || confirmingPassword}
                            aria-busy={confirmingPassword}
                        >
                            {confirmingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {confirmingPassword ? 'Confirming...' : 'Confirm'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={cancelSetup}
                            disabled={confirmingPassword}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        );
    }

    // Backup codes display
    if (setupStep === 'backup-codes') {
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
                        <Download className="mr-2 h-4 w-4" />
                        Download Codes
                    </Button>
                    <Button variant="outline" onClick={copyBackupCodes} className="flex-1">
                        <Copy className="mr-2 h-4 w-4" />
                        Copy to Clipboard
                    </Button>
                </div>

                <Button
                    variant="outline"
                    onClick={() => setSetupStep('idle')}
                    className="w-full"
                >
                    I have saved my codes
                </Button>
            </div>
        );
    }

    // Disable confirmation dialog
    const disableDialog = (
        <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                    <DialogDescription>
                        This will lower your account security. You will no longer need a verification
                        code to sign in. Are you sure you want to continue?
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setShowDisableDialog(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDisableConfirm}
                    >
                        Continue
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    // 2FA is enabled - show status and disable option
    if (isEnabled) {
        return (
            <>
                {disableDialog}
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
                        onClick={initiateDisable}
                        disabled={loading}
                        aria-busy={loading}
                        className="w-full sm:w-auto"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {loading ? 'Disabling...' : 'Disable 2FA'}
                    </Button>
                </div>
            </>
        );
    }

    // QR code setup step
    if (setupStep === 'qr-code' && qrCodeUrl) {
        return (
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
                            <p className="text-xs text-muted-foreground mb-1">Can&apos;t scan? Enter this code manually:</p>
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
                            autoComplete="one-time-code"
                        />
                        <Button onClick={verifyAndEnable} disabled={loading || verificationCode.length !== 6} aria-busy={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? 'Verifying...' : 'Verify & Enable'}
                        </Button>
                    </div>
                </div>

                <Button variant="ghost" size="sm" onClick={cancelSetup}>
                    Cancel Setup
                </Button>
            </div>
        );
    }

    // Default idle state - show enable button
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-5 w-5" />
                <p>Secure your account with two-factor authentication.</p>
            </div>
            <Button onClick={initiateEnable} disabled={loading} aria-busy={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Setting up...' : 'Setup 2FA'}
            </Button>
        </div>
    );
}
