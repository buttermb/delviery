import { Mail } from "lucide-react";
import { ComingSoonPlaceholder } from "@/components/shared/ComingSoonPlaceholder";

export function EmailTemplateSettings() {
  return (
    <ComingSoonPlaceholder
      title="Email Template Customization"
      description="Customize email templates for order confirmations, delivery notifications, and more."
      icon={Mail}
    />
  );
}
