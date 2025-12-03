import { useState, useRef } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { useAutoSave, SaveStatus } from '@/hooks/useAutoSave';
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
import { User, Mail, Camera, Trash2, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export default function AccountSettings() {
  const { admin, tenant } = useTenantAdminAuth();
  const [name, setName] = useState(admin?.name || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { save: saveName, status: nameStatus } = useAutoSave<string>({
    onSave: async (newName) => {
      // TODO: Implement name update via edge function
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call
    },
    onSuccess: () => {
      toast({ title: 'Name updated', description: 'Your display name has been saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update name.', variant: 'destructive' });
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    saveName(value);
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

    // TODO: Upload to storage
    toast({ title: 'Avatar updated', description: 'Your profile picture has been changed.' });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Account</h2>
        <p className="text-muted-foreground mt-1">
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
          {/* Avatar */}
          <div className="flex items-center gap-6 pb-6 border-b">
            <div className="relative group">
              <Avatar className="h-24 w-24 ring-4 ring-background shadow-xl">
                <AvatarImage src={avatarUrl || undefined} alt={admin?.name || 'User'} />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                  {getInitials(admin?.name)}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={handleAvatarClick}
                className={cn(
                  'absolute inset-0 rounded-full flex items-center justify-center',
                  'bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity',
                  'cursor-pointer'
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
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">{admin?.name || 'User'}</h3>
              <p className="text-sm text-muted-foreground">{admin?.email}</p>
              <Badge variant="secondary" className="mt-2">
                {(admin as any)?.role || 'Admin'}
              </Badge>
            </div>
          </div>

          {/* Name */}
          <SettingsRow
            label="Display name"
            description="Your name as it appears across the platform"
          >
            <div className="flex items-center gap-3">
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter your name"
                className="w-64"
              />
              <SaveStatusIndicator status={nameStatus} />
            </div>
          </SettingsRow>

          {/* Email (read-only) */}
          <SettingsRow
            label="Email address"
            description="Your email is used for login and notifications"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{admin?.email}</span>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <Button variant="outline" size="sm" disabled>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">
                  {tenant?.business_name?.[0]?.toUpperCase() || 'B'}
                </span>
              </div>
              <div>
                <p className="font-semibold">{tenant?.business_name}</p>
                <p className="text-sm text-muted-foreground">
                  {tenant?.slug}.bigmikewholesale.com
                </p>
              </div>
            </div>
            <Badge variant="outline">
              {tenant?.subscription_status === 'trial' ? 'Trial' : 'Active'}
            </Badge>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Danger Zone */}
      <SettingsSection
        title="Danger Zone"
        description="Irreversible and destructive actions"
      >
        <SettingsCard className="border-destructive/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-destructive">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and remove all your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

