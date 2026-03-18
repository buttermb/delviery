import { useState, useRef } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { User, Mail, Camera, Trash2, CheckCircle, Layout, Shield, Users, Building2, Palette, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { SidebarModeSwitcher } from '@/components/sidebar/SidebarModeSwitcher';
import { getInitials } from '@/lib/utils/getInitials';
import { useSearchParams } from 'react-router-dom';

export default function AccountSettings() {
  const { admin, tenant } = useTenantAdminAuth();
  const [name, setName] = useState(admin?.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setSearchParams] = useSearchParams();

  const navigateToTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
    // Scroll to top of settings content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { save: saveName, status: nameStatus } = useAutoSave<{ name: string }>({
    onSave: async (data) => {
      const { data: result, error } = await supabase.functions.invoke('update-account-profile', {
        body: { name: data.name },
      });

      if (error) throw error;

      // Check for error in response body (edge functions can return 200 with error)
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update profile');
      }
    },
    onSuccess: () => {
      toast.success('Name updated', { description: 'Your display name has been saved.' });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update name.';
      toast.error('Error', { description: message });
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    saveName({ name: value });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to storage
    try {
      if (!admin?.id) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${admin.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { data: updateData, error: updateError } = await supabase.functions.invoke('update-account-profile', {
        body: { avatar_url: publicUrl },
      });

      if (updateError) throw updateError;

      // Check for error in response body (edge functions can return 200 with error)
      if (updateData && typeof updateData === 'object' && 'error' in updateData && updateData.error) {
        throw new Error(typeof updateData.error === 'string' ? updateData.error : 'Failed to update avatar');
      }

      setAvatarUrl(publicUrl);
      toast.success('Avatar updated', { description: 'Your profile picture has been changed.' });
    } catch (error: unknown) {
      logger.error('Avatar upload failed', error);
      toast.error('Upload failed', { description: error instanceof Error ? error.message : 'Failed to upload avatar' });
    }
  };


  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Account</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information and account preferences
        </p>
      </div>

      {/* Profile Section */}
      <SettingsSection
        title="Profile"
        description="Your personal details and how others see you"
        icon={User}
      >
        <SettingsCard>
          {/* Avatar - responsive layout */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 pb-6 border-b text-center sm:text-left">
            <div className="relative group flex-shrink-0">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 ring-4 ring-background shadow-xl">
                <AvatarImage src={avatarUrl || undefined} alt={admin?.name || 'User'} />
                <AvatarFallback className="text-xl sm:text-2xl bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                  {getInitials(admin?.name, null, 'U')}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={handleAvatarClick}
                className={cn(
                  'absolute inset-0 rounded-full flex items-center justify-center',
                  'bg-black/50 opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 transition-opacity',
                  'cursor-pointer touch-manipulation',
                  // Always show overlay on touch devices
                  'active:opacity-100'
                )}
              >
                <Camera className="h-6 w-6 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{admin?.name || 'User'}</h3>
              <p className="text-sm text-muted-foreground truncate">{admin?.email}</p>
              <Badge variant="secondary" className="mt-2">
                {admin?.role || 'Admin'}
              </Badge>
            </div>
          </div>

          {/* Name */}
          <SettingsRow
            label="Display name"
            description="Your name as it appears across the platform"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter your name"
                className="w-full sm:w-64 min-h-[44px]"
              />
              <SaveStatusIndicator status={nameStatus} />
            </div>
          </SettingsRow>

          {/* Email (read-only) */}
          <SettingsRow
            label="Email address"
            description="Your email is used for login and notifications"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-muted text-sm min-h-[44px] flex-1 sm:flex-none">
                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{admin?.email}</span>
                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              </div>
              <Button variant="outline" size="sm" disabled className="min-h-[44px] w-full sm:w-auto">
                Change
              </Button>
            </div>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {/* Tenant Info */}
      <SettingsSection
        title="Organization"
        description="The business account you're currently managing"
      >
        <SettingsCard>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                <span className="text-lg sm:text-xl font-bold text-primary">
                  {tenant?.business_name?.[0]?.toUpperCase() || 'B'}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">{tenant?.business_name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {tenant?.slug}.floraiq.com
                </p>
              </div>
            </div>
            <Badge variant="outline" className="flex-shrink-0">
              {tenant?.subscription_status === 'trial' ? 'Trial' : 'Active'}
            </Badge>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Quick Links */}
      <SettingsSection
        title="Quick Links"
        description="Navigate to related settings"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigateToTab('security')}
            className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Security & Passwords</p>
                <p className="text-xs text-muted-foreground">Change your password or manage 2FA</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </button>

          <button
            onClick={() => navigateToTab('team')}
            className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Team Management</p>
                <p className="text-xs text-muted-foreground">Invite members and manage roles</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </button>

          <button
            onClick={() => navigateToTab('business')}
            className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Business Details</p>
                <p className="text-xs text-muted-foreground">Manage operating hours and logo</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </button>

          <button
            onClick={() => navigateToTab('appearance')}
            className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Appearance</p>
                <p className="text-xs text-muted-foreground">Change to Light or Dark mode</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </button>
        </div>
      </SettingsSection>

      {/* Sidebar Mode */}
      <SettingsSection
        title="Navigation"
        description="Customize how you navigate the admin panel"
        icon={Layout}
      >
        <SidebarModeSwitcher variant="card" showDescription={true} />
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection
        title="Danger Zone"
        description="Irreversible and destructive actions"
      >
        <SettingsCard className="border-destructive/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-destructive">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="min-h-[44px] w-full sm:w-auto">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="sm:max-w-md mx-4 sm:mx-auto">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and remove all your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="min-h-[44px] w-full sm:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px] w-full sm:w-auto">
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
