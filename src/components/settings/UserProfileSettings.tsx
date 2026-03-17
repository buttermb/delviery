import { User } from "lucide-react";
import { ComingSoonPlaceholder } from "@/components/shared/ComingSoonPlaceholder";

export function UserProfileSettings() {
  return (
    <ComingSoonPlaceholder
      title="User Profile Settings"
      description="Manage your personal profile information, password, and preferences."
      icon={User}
    />
  );
}
