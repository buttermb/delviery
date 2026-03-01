import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import {
  SettingsSection,
  SettingsCard,
} from '@/components/settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Key,
  Smartphone,
  Monitor,
  Globe,
  Clock,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { cn } from '@/lib/utils';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeFetch } from '@/utils/safeFetch';
import { handleError } from '@/utils/errorHandling/handlers';
import { supabase } from '@/integrations/supabase/client';
import { usePasswordBreachCheck } from '@/hooks/usePasswordBreachCheck';
import { PasswordBreachWarning } from '@/components/auth/PasswordBreachWarning';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

function parseUserAgent(userAgent: string | null): { device: string; browser: string } {
  if (!userAgent) return { device: 'Unknown Device', browser: 'Unknown Browser' };

  let device = 'Desktop';
  let browser = 'Browser';

  // Detect device
  if (/iPhone/i.test(userAgent)) device = 'iPhone';
  else if (/iPad/i.test(userAgent)) device = 'iPad';
  else if (/Android/i.test(userAgent)) device = 'Android';
  else if (/Macintosh/i.test(userAgent)) device = 'MacBook';
  else if (/Windows/i.test(userAgent)) device = 'Windows PC';
  else if (/Linux/i.test(userAgent)) device = 'Linux PC';

  // Detect browser
  if (/Chrome/i.test(userAgent) && !/Edge/i.test(userAgent)) {
    const match = userAgent.match(/Chrome\/(\d+)/);
    browser = match ? `Chrome ${match[1]}` : 'Chrome';
  } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    browser = 'Safari';
  } else if (/Firefox/i.test(userAgent)) {
    const match = userAgent.match(/Firefox\/(\d+)/);
    browser = match ? `Firefox ${match[1]}` : 'Firefox';
  } else if (/Edge/i.test(userAgent)) {
    browser = 'Edge';
  }

  return { device, browser };
}

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 15;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  if (score < 40) return { score, label: 'Weak', color: 'bg-destructive' };
  if (score < 70) return { score, label: 'Medium', color: 'bg-amber-500' };
  return { score, label: 'Strong', color: 'bg-emerald-500' };
}

export default function SecuritySettings() {
  const { admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [twoFactorEnabled] = useState(false);

  // Password breach checking
  const { checking: breachChecking, result: breachResult, suggestPassword } = usePasswordBreachCheck(passwordData.newPassword);

  // Get current session token for comparison
  const currentToken = localStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);

  // Fetch real sessions from admin_sessions table
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: queryKeys.adminSessions.byAdmin(admin?.id),
    queryFn: async () => {
      if (!admin?.id) return [];

      const { data, error } = await supabase
        .from('admin_sessions')
        .select('id, admin_id, token_hash, user_agent, ip_address, created_at, expires_at')
        .eq('admin_id', admin.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch sessions', error);
        return [];
      }

      return (data ?? []).map(session => {
        const { device, browser } = parseUserAgent(session.user_agent);
        const isCurrent = session.token_hash === currentToken?.substring(0, 64); // Compare first part of token
        
        return {
          id: session.id,
          device,
          browser,
          location: 'Unknown Location', // IP geolocation would require external service
          ip: session.ip_address || 'Unknown',
          lastActive: isCurrent ? 'Now' : formatSmartDate(session.created_at, { includeTime: true }),
          current: isCurrent,
        } as Session;
      });
    },
    enabled: !!admin?.id,
  });

  // Revoke session mutation
  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('admin_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSessions.byAdmin(admin?.id) });
      toast.success('Session revoked', { description: 'The device has been signed out.' });
    },
    onError: (error) => {
      toast.error('Failed to revoke session', { description: humanizeError(error) });
    },
  });

  // Revoke all other sessions mutation
  const revokeAllSessionsMutation = useMutation({
    mutationFn: async () => {
      const currentSession = sessions.find(s => s.current);
      if (!currentSession) throw new Error('No current session found');

      const { error } = await supabase
        .from('admin_sessions')
        .delete()
        .eq('admin_id', admin?.id)
        .neq('id', currentSession.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSessions.byAdmin(admin?.id) });
      toast.success('All sessions revoked', { description: 'You have been signed out of all other devices.' });
    },
    onError: (error) => {
      toast.error('Failed to revoke sessions', { description: humanizeError(error) });
    },
  });

  const passwordStrength = getPasswordStrength(passwordData.newPassword);

  const handleUpdatePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Missing fields', { description: 'Please fill in all password fields' });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords don\'t match', { description: 'New password and confirmation must match' });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Password too short', { description: 'Password must be at least 8 characters' });
      return;
    }

    if (breachResult?.blocked) {
      toast.error('Password not allowed', { description: 'This password has been found in too many data breaches. Please choose a different password.' });
      return;
    }

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await safeFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN)}`,
        },
        body: JSON.stringify({
          action: 'update-password',
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update password');

      toast.success('Password updated', { description: 'Your password has been changed successfully.' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      handleError(error, { component: 'SecuritySettings', toastTitle: 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Security</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Protect your account with passwords, 2FA, and session management
        </p>
      </div>

      {/* Password Section */}
      <SettingsSection
        title="Password"
        description="Change your password to keep your account secure"
        icon={Key}
      >
        <SettingsCard>
          <div className="space-y-4">
            {/* Current Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Password</label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, currentPassword: e.target.value })
                  }
                  placeholder="Enter current password"
                  className="pr-10 min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-1"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  placeholder="Enter new password"
                  className="pr-10 min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-1"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Password Strength */}
              {passwordData.newPassword && (
                <div className="space-y-2">
                  <Progress value={passwordStrength.score} className="h-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn(
                      'font-medium',
                      passwordStrength.score < 40 && 'text-destructive',
                      passwordStrength.score >= 40 && passwordStrength.score < 70 && 'text-amber-500',
                      passwordStrength.score >= 70 && 'text-emerald-500'
                    )}>
                      {passwordStrength.label}
                    </span>
                    <span className="text-muted-foreground">Min 8 characters</span>
                  </div>
                </div>
              )}
              {/* Password Breach Check */}
              {passwordData.newPassword.length >= 8 && (
                <PasswordBreachWarning
                  checking={breachChecking}
                  result={breachResult}
                  suggestPassword={suggestPassword}
                  onGeneratePassword={(pw) => setPasswordData({ ...passwordData, newPassword: pw, confirmPassword: pw })}
                />
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm new password"
                  className="pr-10 min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-1"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> Passwords don't match
                </p>
              )}
              {passwordData.confirmPassword && passwordData.newPassword === passwordData.confirmPassword && (
                <p className="text-xs text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Passwords match
                </p>
              )}
            </div>

            <Button 
              onClick={handleUpdatePassword} 
              disabled={loading}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Two-Factor Authentication */}
      <SettingsSection
        title="Two-Factor Authentication"
        description="Add an extra layer of security with 2FA"
        icon={Smartphone}
        action={
          <Badge variant={twoFactorEnabled ? 'default' : 'secondary'}>
            {twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        }
      >
        <SettingsCard>
          <TwoFactorSetup />
        </SettingsCard>
      </SettingsSection>

      {/* Active Sessions */}
      <SettingsSection
        title="Active Sessions"
        description="Manage devices where you're currently logged in"
        icon={Monitor}
        action={
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => revokeAllSessionsMutation.mutate()}
            disabled={revokeAllSessionsMutation.isPending || sessions.filter(s => !s.current).length === 0}
            className="min-h-[44px] text-xs sm:text-sm"
          >
            {revokeAllSessionsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <LogOut className="h-4 w-4 mr-1.5 sm:mr-2" />
            <span className="hidden sm:inline">Sign out all</span>
            <span className="sm:hidden">Sign out</span>
          </Button>
        }
      >
        <SettingsCard>
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No active sessions found</p>
            </div>
          ) : (
            <div className="divide-y">
              {sessions.map((session) => (
                <div 
                  key={session.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      {session.device.includes('iPhone') || session.device.includes('Android') ? (
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Monitor className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{session.device}</span>
                        {session.current && (
                          <Badge variant="secondary" className="text-[10px]">
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-0.5">
                        <span>{session.browser}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {session.ip}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {session.lastActive}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!session.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeSessionMutation.mutate(session.id)}
                      disabled={revokeSessionMutation.isPending}
                      className="text-destructive hover:text-destructive min-h-[44px] w-full sm:w-auto"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      {/* Security Tips */}
      <SettingsCard className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3 sm:gap-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800 dark:text-amber-200">Security Recommendations</h4>
            <ul className="mt-2 space-y-1 text-xs sm:text-sm text-amber-700 dark:text-amber-300">
              <li>• Enable two-factor authentication for extra protection</li>
              <li>• Use a strong, unique password with at least 12 characters</li>
              <li>• Review your active sessions regularly</li>
              <li>• Never share your login credentials</li>
            </ul>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
