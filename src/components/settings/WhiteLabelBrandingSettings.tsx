import { Card } from '@/components/ui/card';
import { Palette } from 'lucide-react';

export function WhiteLabelBrandingSettings() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Palette className="h-5 w-5" />
        White-Label Branding Settings
      </h3>
      <p className="text-muted-foreground">
        Customize your storefront with custom colors, logos, and domain for a fully branded experience.
      </p>
      <div className="mt-4 text-sm text-muted-foreground">
        Coming soon: Full white-label branding with custom domain, colors, and logos.
      </div>
    </Card>
  );
}
