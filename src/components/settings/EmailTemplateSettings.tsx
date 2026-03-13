import { Card } from '@/components/ui/card';
import { Mail } from 'lucide-react';

export function EmailTemplateSettings() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Mail className="h-5 w-5" />
        Email Template Customization
      </h3>
      <p className="text-muted-foreground">
        Customize email templates for order confirmations, delivery notifications, and more.
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        Coming soon: Customize all email templates with your branding and custom content.
      </div>
    </Card>
  );
}
