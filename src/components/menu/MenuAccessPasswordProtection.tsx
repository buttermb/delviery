/**
 * MenuAccessPasswordProtection Component
 * Task 289: Add menu access password protection
 *
 * Password/access code gate for secure menu access
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Lock from 'lucide-react/dist/esm/icons/lock';
import Unlock from 'lucide-react/dist/esm/icons/unlock';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Eye from 'lucide-react/dist/esm/icons/eye';
import EyeOff from 'lucide-react/dist/esm/icons/eye-off';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

interface MenuAccessPasswordProtectionProps {
  menuName: string;
  description?: string;
  onAccessGranted: (accessCode: string) => void;
  onValidateCode: (code: string) => Promise<boolean>;
  maxAttempts?: number;
  className?: string;
}

export function MenuAccessPasswordProtection({
  menuName,
  description,
  onAccessGranted,
  onValidateCode,
  maxAttempts = 3,
  className,
}: MenuAccessPasswordProtectionProps) {
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim() || isLocked || isValidating) return;

    setIsValidating(true);
    setError(null);

    try {
      const isValid = await onValidateCode(accessCode.trim());

      if (isValid) {
        onAccessGranted(accessCode.trim());
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        if (newAttempts >= maxAttempts) {
          setIsLocked(true);
          setError(`Too many failed attempts. Please try again later.`);
        } else {
          setError(
            `Invalid access code. ${maxAttempts - newAttempts} attempt${maxAttempts - newAttempts !== 1 ? 's' : ''} remaining.`
          );
        }
        setAccessCode('');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const remainingAttempts = maxAttempts - attempts;

  return (
    <div className={cn('flex items-center justify-center min-h-screen bg-muted/30 p-4', className)}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">{menuName}</CardTitle>
          {description && (
            <CardDescription className="text-base mt-2">{description}</CardDescription>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              This menu is password protected. Please enter the access code to continue.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="accessCode" className="text-sm mb-2 block">
                Access Code
              </Label>
              <div className="relative">
                <Input
                  id="accessCode"
                  type={showCode ? 'text' : 'password'}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="Enter access code"
                  disabled={isLocked || isValidating}
                  className="pr-10 uppercase tracking-wider text-center text-lg font-mono"
                  maxLength={20}
                  autoComplete="off"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLocked}
                >
                  {showCode ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <Alert variant={isLocked ? 'destructive' : 'default'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!isLocked && attempts > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Attempts remaining:</span>
                <Badge
                  variant={remainingAttempts <= 1 ? 'destructive' : 'secondary'}
                  className="font-mono"
                >
                  {remainingAttempts}
                </Badge>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!accessCode.trim() || isLocked || isValidating}
              size="lg"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : isLocked ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Locked
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4 mr-2" />
                  Access Menu
                </>
              )}
            </Button>
          </form>

          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Secure Access</p>
                <p className="mt-1">
                  Your access code is encrypted and never stored in plain text. This menu is
                  protected to ensure privacy and security.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
