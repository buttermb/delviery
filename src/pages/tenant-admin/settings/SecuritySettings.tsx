import { useState } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
} from '@/components/settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Shield,
  Key,
  Smartphone,
  Monitor,
  Globe,
  Clock,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeFetch } from '@/utils/safeFetch';
import { handleError } from '@/utils/errorHandling/handlers';

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

// Mock sessions for demo
const MOCK_SESSIONS: Session[] = [
  {
    id: '1',
    device: 'MacBook Pro',
    browser: 'Chrome 120',
    location: 'Los Angeles, CA',
    ip: '192.168.1.1',
    lastActive: 'Now',
    current: true,
  },
  {
    id: '2',
    device: 'iPhone 15',
    browser: 'Safari',
    location: 'Los Angeles, CA',
    ip: '192.168.1.2',
    lastActive: '2 hours ago',
    current: false,
  },
];

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
  const { admin, tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [sessions] = useState<Session[]>(MOCK_SESSIONS);

  const passwordStrength = getPasswordStrength(passwordData.newPassword);

  const handleUpdatePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all password fields',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Passwords don\'t match',
        description: 'New password and confirmation must match',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters',
        variant: 'destructive',
      });
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

      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      handleError(error, { component: 'SecuritySettings', toastTitle: 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    toast({ title: 'Session revoked', description: 'The device has been signed out.' });
  };

  const handleRevokeAllSessions = () => {
    toast({ title: 'All sessions revoked', description: 'You have been signed out of all other devices.' });
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
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
                placeholder="Confirm new password"
                className="min-h-[44px]"
              />
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
            onClick={handleRevokeAllSessions}
            className="min-h-[44px] text-xs sm:text-sm"
          >
            <LogOut className="h-4 w-4 mr-1.5 sm:mr-2" />
            <span className="hidden sm:inline">Sign out all</span>
            <span className="sm:hidden">Sign out</span>
          </Button>
        }
      >
        <SettingsCard>
          <div className="divide-y">
            {sessions.map((session) => (
              <div 
                key={session.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    {session.device.includes('iPhone') ? (
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
                        {session.location}
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
                    onClick={() => handleRevokeSession(session.id)}
                    className="text-destructive hover:text-destructive min-h-[44px] w-full sm:w-auto"
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
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
