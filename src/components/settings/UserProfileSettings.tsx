import { Card } from '@/components/ui/card';
import { User } from 'lucide-react';

export function UserProfileSettings() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <User className="h-5 w-5" />
        User Profile Settings
      </h3>
      <p className="text-muted-foreground">
        Manage your personal profile information, password, and preferences.
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        Coming soon: Update your profile, change password, and manage personal preferences.
      </div>
    </Card>
  );
}
